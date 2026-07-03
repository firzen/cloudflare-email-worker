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

const CLOUDFLARE_RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const CLOUDFLARE_MAX_ATTEMPTS = 3;
const CLOUDFLARE_RETRY_DELAYS_MS = [250, 1000];
const CLOUDFLARE_REQUEST_TIMEOUT_MS = 8000;

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
  adminUserId?: string,
): Promise<CloudflareSyncResult> {
  const syncStartedAt = Date.now();
  console.log(
    "[cloudflare-sync] start",
    JSON.stringify({
      adminUserId: adminUserId ?? null,
      workerName: env.CLOUDFLARE_WORKER_NAME,
    }),
  );
  assertCloudflareSyncConfig(env);

  const zones = await listManagedZones(env);
  const items: CloudflareSyncItem[] = [];
  console.log(
    "[cloudflare-sync] zones_loaded",
    JSON.stringify({
      totalZones: zones.length,
      sampleDomains: zones.slice(0, 5).map((zone) => zone.name),
    }),
  );

  for (const zone of zones) {
    const actions: string[] = [];
    const zoneStartedAt = Date.now();
    console.log(
      "[cloudflare-sync] zone_start",
      JSON.stringify({ domain: zone.name, zoneId: zone.id }),
    );
    try {
      await runSyncStep(zone, "routing", actions, () => ensureEmailRouting(env, zone, actions));
      await runSyncStep(zone, "catch_all", actions, () => ensureCatchAllWorker(env, zone, actions));
      await runSyncStep(zone, "email_sending", actions, () => ensureSendingDomain(env, zone, actions));
      await runSyncStep(zone, "database", actions, () =>
        syncZoneIntoDatabase(env, zone, adminUserId, actions),
      );

      items.push({
        domain: zone.name,
        zoneId: zone.id,
        status: "success",
        actions,
      });
      console.log(
        "[cloudflare-sync] zone_success",
        JSON.stringify({
          domain: zone.name,
          zoneId: zone.id,
          durationMs: Date.now() - zoneStartedAt,
          actions,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error.";
      items.push({
        domain: zone.name,
        zoneId: zone.id,
        status: "failed",
        actions,
        failedStep: inferFailedStep(error),
        error: message,
      });
      console.error(
        "[cloudflare-sync] zone_failed",
        JSON.stringify({
          domain: zone.name,
          zoneId: zone.id,
          durationMs: Date.now() - zoneStartedAt,
          actions,
          failedStep: inferFailedStep(error),
          error: message,
        }),
      );
    }
  }

  const succeededDomains = items.filter((item) => item.status === "success").length;
  const failedDomains = items.length - succeededDomains;

  const result = {
    totalDomains: items.length,
    succeededDomains,
    failedDomains,
    items,
  };

  console.log(
    "[cloudflare-sync] finish",
    JSON.stringify({
      totalDomains: result.totalDomains,
      succeededDomains: result.succeededDomains,
      failedDomains: result.failedDomains,
      durationMs: Date.now() - syncStartedAt,
    }),
  );

  return result;
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
  adminUserId: string | undefined,
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
  let lastError: CloudflareRequestError | null = null;

  for (let attempt = 1; attempt <= CLOUDFLARE_MAX_ATTEMPTS; attempt += 1) {
    const requestStartedAt = Date.now();
    try {
      console.log(
        "[cloudflare-sync] request_start",
        JSON.stringify({
          step,
          attempt,
          method: init?.method ?? "GET",
          path,
        }),
      );
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLOUDFLARE_REQUEST_TIMEOUT_MS);
      const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      }).finally(() => clearTimeout(timeout));

      const rawBody = await response.text();
      const json = parseCloudflareResponse<T>(rawBody);

      if (!response.ok || json?.success === false) {
        const errorMessage =
          json?.errors?.map((error) => error.message).filter(Boolean).join("; ") ||
          buildUnexpectedResponseMessage(response.status, rawBody);
        throw createCloudflareRequestError(
          `${step}: ${errorMessage}`,
          CLOUDFLARE_RETRYABLE_STATUS_CODES.has(response.status),
        );
      }

      if (!json) {
        throw createCloudflareRequestError(
          `${step}: ${buildUnexpectedResponseMessage(response.status, rawBody)}`,
          CLOUDFLARE_RETRYABLE_STATUS_CODES.has(response.status),
        );
      }

      console.log(
        "[cloudflare-sync] request_success",
        JSON.stringify({
          step,
          attempt,
          method: init?.method ?? "GET",
          path,
          status: response.status,
          durationMs: Date.now() - requestStartedAt,
        }),
      );
      return json;
    } catch (error) {
      const normalizedError = normalizeCloudflareRequestError(error, step);
      console.error(
        "[cloudflare-sync] request_failed",
        JSON.stringify({
          step,
          attempt,
          method: init?.method ?? "GET",
          path,
          durationMs: Date.now() - requestStartedAt,
          retryable: Boolean(normalizedError.retryable),
          error: normalizedError.message,
        }),
      );

      if (attempt < CLOUDFLARE_MAX_ATTEMPTS && normalizedError.retryable) {
        lastError = normalizedError;
        await sleep(CLOUDFLARE_RETRY_DELAYS_MS[attempt - 1] ?? 1000);
        continue;
      }

      throw normalizedError;
    }
  }

  throw lastError ?? new Error(`${step}: Cloudflare API request failed.`);
}

function inferFailedStep(error: unknown) {
  if (!(error instanceof Error)) {
    return "unknown";
  }

  const [step] = error.message.split(":");
  return step || "unknown";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSyncStep(
  zone: CloudflareZone,
  step: string,
  actions: string[],
  runner: () => Promise<void>,
) {
  const startedAt = Date.now();
  console.log(
    "[cloudflare-sync] step_start",
    JSON.stringify({
      domain: zone.name,
      zoneId: zone.id,
      step,
      actions,
    }),
  );

  try {
    await runner();
    console.log(
      "[cloudflare-sync] step_success",
      JSON.stringify({
        domain: zone.name,
        zoneId: zone.id,
        step,
        durationMs: Date.now() - startedAt,
        actions,
      }),
    );
  } catch (error) {
    console.error(
      "[cloudflare-sync] step_failed",
      JSON.stringify({
        domain: zone.name,
        zoneId: zone.id,
        step,
        durationMs: Date.now() - startedAt,
        actions,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    throw error;
  }
}

type CloudflareApiEnvelope<T> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
} & T;

type CloudflareRequestError = Error & {
  retryable?: boolean;
};

function parseCloudflareResponse<T>(rawBody: string): CloudflareApiEnvelope<T> | null {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as CloudflareApiEnvelope<T>;
  } catch {
    return null;
  }
}

function buildUnexpectedResponseMessage(status: number, rawBody: string) {
  const snippet = rawBody.replace(/\s+/g, " ").trim().slice(0, 160);
  return snippet
    ? `Cloudflare API request failed with status ${status}: ${snippet}`
    : `Cloudflare API request failed with status ${status}`;
}

function createCloudflareRequestError(message: string, retryable = false): CloudflareRequestError {
  const error = new Error(message) as CloudflareRequestError;
  error.retryable = retryable;
  return error;
}

function normalizeCloudflareRequestError(
  error: unknown,
  step: string,
): CloudflareRequestError {
  if (error instanceof Error && "retryable" in error) {
    return error as CloudflareRequestError;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return createCloudflareRequestError(
      `${step}: Cloudflare API request timed out after ${CLOUDFLARE_REQUEST_TIMEOUT_MS}ms`,
      true,
    );
  }

  if (error instanceof Error) {
    const message = error.message.startsWith(`${step}: `)
      ? error.message
      : `${step}: ${error.message}`;
    return createCloudflareRequestError(message, true);
  }

  return createCloudflareRequestError(`${step}: ${String(error)}`, true);
}
