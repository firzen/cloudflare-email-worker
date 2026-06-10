import { runStatement } from "../db";
import type { Env } from "../../types/env";

type CloudflareZone = {
  id: string;
  name: string;
  status: string;
  type: string;
};

type CloudflareRoutingSettings = {
  enabled: boolean;
  status?: string;
};

type CloudflareCatchAllRule = {
  enabled: boolean;
  actions?: Array<{ type: string; value?: string[] }>;
};

type CloudflareSendingDomain = {
  id: string;
  name: string;
  enabled: boolean;
  return_path_domain: string;
};

export type CloudflareSyncItem = {
  domain: string;
  zoneId: string;
  status: "success" | "failed";
  actions: string[];
  failedStep?: string;
  error?: string;
};

export type CloudflareSyncResult = {
  totalDomains: number;
  succeededDomains: number;
  failedDomains: number;
  items: CloudflareSyncItem[];
};

export async function runCloudflareAdminSync(
  env: Env,
  adminUserId: string,
): Promise<CloudflareSyncResult> {
  assertCloudflareSyncConfig(env);

  const zones = await listManagedZones(env);
  const items: CloudflareSyncItem[] = [];

  for (const zone of zones) {
    const actions: string[] = [];
    try {
      await ensureEmailRouting(env, zone, actions);
      await ensureCatchAllWorker(env, zone, actions);
      await ensureSendingDomain(env, zone, actions);
      await syncZoneIntoDatabase(env, zone, adminUserId, actions);

      items.push({
        domain: zone.name,
        zoneId: zone.id,
        status: "success",
        actions,
      });
    } catch (error) {
      items.push({
        domain: zone.name,
        zoneId: zone.id,
        status: "failed",
        actions,
        failedStep: inferFailedStep(error),
        error: error instanceof Error ? error.message : "Unknown sync error.",
      });
    }
  }

  const succeededDomains = items.filter((item) => item.status === "success").length;
  const failedDomains = items.length - succeededDomains;

  return {
    totalDomains: items.length,
    succeededDomains,
    failedDomains,
    items,
  };
}

function assertCloudflareSyncConfig(env: Env) {
  const missing = [
    ["CLOUDFLARE_ACCOUNT_ID", env.CLOUDFLARE_ACCOUNT_ID],
    ["CLOUDFLARE_API_TOKEN", env.CLOUDFLARE_API_TOKEN],
    ["CLOUDFLARE_WORKER_NAME", env.CLOUDFLARE_WORKER_NAME],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing Cloudflare sync configuration: ${missing.join(", ")}`);
  }
}

async function listManagedZones(env: Env) {
  const response = await cloudflareRequest<{ result: CloudflareZone[] }>(
    env,
    "/zones?per_page=100",
  );

  return (response.result ?? []).filter(
    (zone) => zone.status === "active" && zone.type === "full",
  );
}

async function ensureEmailRouting(env: Env, zone: CloudflareZone, actions: string[]) {
  const settings = await cloudflareRequest<{ result: CloudflareRoutingSettings }>(
    env,
    `/zones/${zone.id}/email/routing`,
  );

  if (settings.result?.enabled && settings.result?.status === "ready") {
    actions.push("routing_verified");
    return;
  }

  await cloudflareRequest(
    env,
    `/zones/${zone.id}/email/routing/enable`,
    { method: "POST" },
    "routing_enable",
  );
  actions.push("routing_enabled");
}

async function ensureCatchAllWorker(env: Env, zone: CloudflareZone, actions: string[]) {
  const rule = await cloudflareRequest<{ result: CloudflareCatchAllRule }>(
    env,
    `/zones/${zone.id}/email/routing/rules/catch_all`,
  );

  const alreadyBound =
    rule.result?.enabled === true &&
    (rule.result?.actions ?? []).some(
      (action) =>
        action.type === "worker" &&
        Array.isArray(action.value) &&
        action.value.includes(env.CLOUDFLARE_WORKER_NAME),
    );

  if (alreadyBound) {
    actions.push("catch_all_verified");
    return;
  }

  await cloudflareRequest(
    env,
    `/zones/${zone.id}/email/routing/rules/catch_all`,
    {
      method: "PUT",
      body: JSON.stringify({
        actions: [{ type: "worker", value: [env.CLOUDFLARE_WORKER_NAME] }],
        enabled: true,
      }),
    },
    "catch_all",
  );
  actions.push("catch_all_bound");
}

async function ensureSendingDomain(env: Env, zone: CloudflareZone, actions: string[]) {
  const sending = await cloudflareRequest<{ result: CloudflareSendingDomain[] }>(
    env,
    `/zones/${zone.id}/email/sending/subdomains`,
  );

  const existing = (sending.result ?? []).find(
    (entry) => entry.name === zone.name && entry.enabled,
  );

  if (existing) {
    actions.push("email_sending_verified");
    return;
  }

  await cloudflareRequest(
    env,
    `/zones/${zone.id}/email/sending/subdomains`,
    {
      method: "POST",
      body: JSON.stringify({ name: zone.name }),
    },
    "email_sending",
  );
  actions.push("email_sending_created");
}

async function syncZoneIntoDatabase(
  env: Env,
  zone: CloudflareZone,
  adminUserId: string,
  actions: string[],
) {
  const domainId = `dom_${zone.id}`;
  const mailboxId = `mbx_catch_all_${zone.id}`;
  const fullAddress = `*@${zone.name}`;
  const adminIds = Array.from(
    new Set(
      [adminUserId, env.BOOTSTRAP_ADMIN_USER_ID].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  );

  await runStatement(
    env.DB,
    `
      INSERT INTO domains (id, domain, status)
      VALUES (?, ?, 'active')
      ON CONFLICT(domain) DO UPDATE SET
        id = excluded.id,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `,
    domainId,
    zone.name,
  );

  await runStatement(
    env.DB,
    `
      INSERT INTO mailboxes (id, domain_id, local_part, full_address, route_type, can_reply, status)
      VALUES (?, ?, ?, ?, 'catch_all', 1, 'active')
      ON CONFLICT(full_address) DO UPDATE SET
        id = excluded.id,
        domain_id = excluded.domain_id,
        local_part = excluded.local_part,
        route_type = 'catch_all',
        can_reply = 1,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `,
    mailboxId,
    domainId,
    "*",
    fullAddress,
  );

  for (const targetUserId of adminIds) {
    for (const permission of ["read", "reply", "manage"]) {
      await runStatement(
        env.DB,
        `
          INSERT OR IGNORE INTO user_mailbox_permissions (
            id,
            user_id,
            mailbox_id,
            permission
          ) VALUES (?, ?, ?, ?)
        `,
        `ump_${targetUserId}_${mailboxId}_${permission}`,
        targetUserId,
        mailboxId,
        permission,
      );
    }
  }

  actions.push("database_synced");
}

async function cloudflareRequest<T>(
  env: Env,
  path: string,
  init?: RequestInit,
  step = "cloudflare_api",
): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json = (await response.json()) as {
    success?: boolean;
    errors?: Array<{ message?: string }>;
  } & T;

  if (!response.ok || json.success === false) {
    const errorMessage =
      json.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
      `Cloudflare API request failed with status ${response.status}`;
    throw new Error(`${step}: ${errorMessage}`);
  }

  return json;
}

function inferFailedStep(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const [step] = error.message.split(":");
  return step || "unknown";
}
