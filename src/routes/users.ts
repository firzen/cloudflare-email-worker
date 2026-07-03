import { Context, Hono } from "hono";
import { hashPassword } from "../lib/auth";
import {
  getExecutionContextOrNull,
  scheduleExceptionReport,
} from "../lib/alerts";
import { createId } from "../lib/id";
import { firstRow, runStatement } from "../lib/db";
import { runCloudflareAdminSync } from "../lib/cloudflare/admin-sync";
import type { Env } from "../types/env";

type AppVariables = {
  userId: string | null;
};

function unauthorizedResponse() {
  return {
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  } as const;
}

function forbiddenResponse() {
  return {
    error: { code: "FORBIDDEN", message: "Admin access required." },
  } as const;
}

function validationErrorResponse(message: string) {
  return {
    error: { code: "VALIDATION_ERROR", message },
  } as const;
}

function notFoundResponse(message: string) {
  return {
    error: { code: "USER_NOT_FOUND", message },
  } as const;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "operator";
  status: "active" | "disabled";
};

type UserPermissionRow = {
  mailbox_id: string;
  full_address: string;
  permission: string | null;
};

function reportUsersException(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  error: unknown,
  step: string,
  details?: Record<string, unknown>,
) {
  scheduleExceptionReport(c.env, getExecutionContextOrNull(c), error, {
    source: "users-route",
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    userId: c.get("userId"),
    step,
    details: details ?? null,
  });
}

async function requireAdmin(db: D1Database, userId: string) {
  const user = await firstRow<{ id: string; role: string }>(
    db,
    `
      SELECT id, role
      FROM users
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
    `,
    userId,
  );

  return user?.role === "admin";
}

async function requireAdminUser(c: any) {
  const userId = c.get("userId");

  if (!userId) {
    return { ok: false as const, response: c.json(unauthorizedResponse(), 401) };
  }

  if (!(await requireAdmin(c.env.DB, userId))) {
    return { ok: false as const, response: c.json(forbiddenResponse(), 403) };
  }

  return { ok: true as const, userId };
}

async function getUserById(db: D1Database, id: string) {
  return firstRow<UserRow>(
    db,
    `
      SELECT id, email, name, role, status
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    id,
  );
}

function normalizeRole(value: unknown) {
  return value === "admin" || value === "operator" ? value : null;
}

function normalizeStatus(value: unknown) {
  return value === "active" || value === "disabled" ? value : null;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function countActiveAdmins(db: D1Database) {
  const row = await firstRow<{ total: number | string }>(
    db,
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE role = 'admin'
        AND status = 'active'
    `,
  );

  return Number(row?.total ?? 0);
}

async function writeUserAuditLog(
  db: D1Database,
  actorUserId: string,
  targetUserId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await runStatement(
    db,
    `
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        target_type,
        target_id,
        target_user_id,
        metadata_json
      ) VALUES (?, ?, ?, 'user', ?, ?, ?)
    `,
    createId("aud"),
    actorUserId,
    action,
    targetUserId,
    targetUserId,
    JSON.stringify(metadata),
  );
}

export const usersRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

usersRouter.get("/", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const result = await c.env.DB.prepare(
    `
      SELECT id, email, name, role, status
      FROM users
      ORDER BY email ASC
    `,
  )
    .bind()
    .all();

  return c.json({ items: result.results ?? [] });
});

usersRouter.post("/", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = await c.req.json<{
    email?: string;
    name?: string;
    role?: string;
    password?: string;
  }>();

  const email = normalizeEmail(body.email);
  const name = normalizeName(body.name);
  const role = normalizeRole(body.role);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    return c.json(validationErrorResponse("Email is required."), 400);
  }

  if (!name) {
    return c.json(validationErrorResponse("Name is required."), 400);
  }

  if (!role) {
    return c.json(validationErrorResponse("Role must be admin or operator."), 400);
  }

  if (!password) {
    return c.json(validationErrorResponse("Password is required."), 400);
  }

  const id = createId("usr");
  const passwordHash = await hashPassword(password);

  try {
    await runStatement(
      c.env.DB,
      `
        INSERT INTO users (
          id,
          email,
          name,
          role,
          status,
          password_hash
        ) VALUES (?, ?, ?, ?, 'active', ?)
      `,
      id,
      email,
      name,
      role,
      passwordHash,
    );

    await writeUserAuditLog(c.env.DB, adminCheck.userId, id, "user.create", {
      email,
      role,
    });
  } catch (error) {
    return c.json(
      validationErrorResponse(
        error instanceof Error && /UNIQUE constraint failed: users\.email/u.test(error.message)
          ? "A user with that email already exists."
          : "User could not be created.",
      ),
      400,
    );
  }

  return c.json({
    user: { id, email, name, role, status: "active" },
  });
});

usersRouter.get("/:id", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const user = await getUserById(c.env.DB, c.req.param("id"));
  if (!user) {
    return c.json(notFoundResponse("User not found."), 404);
  }

  return c.json({ user });
});

usersRouter.put("/:id", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const targetUserId = c.req.param("id");
  const existing = await getUserById(c.env.DB, targetUserId);
  if (!existing) {
    return c.json(notFoundResponse("User not found."), 404);
  }

  const body = await c.req.json<{
    email?: string;
    name?: string;
    role?: string;
    status?: string;
    password?: string;
  }>();

  const email = normalizeEmail(body.email);
  const name = normalizeName(body.name);
  const role = normalizeRole(body.role);
  const status = normalizeStatus(body.status);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    return c.json(validationErrorResponse("Email is required."), 400);
  }

  if (!name) {
    return c.json(validationErrorResponse("Name is required."), 400);
  }

  if (!role) {
    return c.json(validationErrorResponse("Role must be admin or operator."), 400);
  }

  if (!status) {
    return c.json(validationErrorResponse("Status must be active or disabled."), 400);
  }

  if (targetUserId === adminCheck.userId && status !== "active") {
    return c.json(validationErrorResponse("You cannot disable your own account."), 400);
  }

  if (targetUserId === adminCheck.userId && role !== "admin") {
    return c.json(validationErrorResponse("You cannot remove your own admin role."), 400);
  }

  const removingActiveAdmin =
    existing.role === "admin" &&
    existing.status === "active" &&
    (role !== "admin" || status !== "active");

  if (removingActiveAdmin && (await countActiveAdmins(c.env.DB)) <= 1) {
    return c.json(validationErrorResponse("At least one active admin is required."), 400);
  }

  try {
    if (password) {
      const passwordHash = await hashPassword(password);
      await runStatement(
        c.env.DB,
        `
          UPDATE users
          SET email = ?,
              name = ?,
              role = ?,
              status = ?,
              password_hash = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        email,
        name,
        role,
        status,
        passwordHash,
        targetUserId,
      );
    } else {
      await runStatement(
        c.env.DB,
        `
          UPDATE users
          SET email = ?,
              name = ?,
              role = ?,
              status = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        email,
        name,
        role,
        status,
        targetUserId,
      );
    }

    if (status === "disabled") {
      await runStatement(
        c.env.DB,
        `
          DELETE FROM user_mailbox_permissions
          WHERE user_id = ?
        `,
        targetUserId,
      );
    }

    await writeUserAuditLog(c.env.DB, adminCheck.userId, targetUserId, "user.update", {
      email,
      role,
      status,
      passwordChanged: Boolean(password),
    });
  } catch (error) {
    return c.json(
      validationErrorResponse(
        error instanceof Error && /UNIQUE constraint failed: users\.email/u.test(error.message)
          ? "A user with that email already exists."
          : "User could not be updated.",
      ),
      400,
    );
  }

  return c.json({
    user: { id: targetUserId, email, name, role, status },
  });
});

usersRouter.delete("/:id", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const targetUserId = c.req.param("id");
  const existing = await getUserById(c.env.DB, targetUserId);
  if (!existing) {
    return c.json(notFoundResponse("User not found."), 404);
  }

  if (targetUserId === adminCheck.userId) {
    return c.json(validationErrorResponse("You cannot delete your own account."), 400);
  }

  if (
    existing.role === "admin" &&
    existing.status === "active" &&
    (await countActiveAdmins(c.env.DB)) <= 1
  ) {
    return c.json(validationErrorResponse("At least one active admin is required."), 400);
  }

  await runStatement(
    c.env.DB,
    `
      UPDATE users
      SET status = 'disabled',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    targetUserId,
  );

  await runStatement(
    c.env.DB,
    `
      DELETE FROM user_mailbox_permissions
      WHERE user_id = ?
    `,
    targetUserId,
  );

  await writeUserAuditLog(c.env.DB, adminCheck.userId, targetUserId, "user.disable", {
    priorRole: existing.role,
  });

  return c.json({ ok: true });
});

usersRouter.get("/:id/permissions", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const targetUserId = c.req.param("id");
  const existing = await getUserById(c.env.DB, targetUserId);
  if (!existing) {
    return c.json(notFoundResponse("User not found."), 404);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT
        m.id AS mailbox_id,
        m.full_address,
        ump.permission
      FROM mailboxes m
      LEFT JOIN user_mailbox_permissions ump
        ON ump.mailbox_id = m.id
       AND ump.user_id = ?
      WHERE m.status = 'active'
      ORDER BY m.full_address ASC, ump.permission ASC
    `,
  )
    .bind(targetUserId)
    .all<UserPermissionRow>();

  const grouped = new Map<string, { mailboxId: string; fullAddress: string; permissions: string[] }>();
  for (const row of result.results ?? []) {
    const current = grouped.get(row.mailbox_id) ?? {
      mailboxId: row.mailbox_id,
      fullAddress: row.full_address,
      permissions: [],
    };
    if (row.permission) {
      current.permissions.push(row.permission);
    }
    grouped.set(row.mailbox_id, current);
  }

  return c.json({ items: Array.from(grouped.values()) });
});

usersRouter.put("/:id/permissions", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const targetUserId = c.req.param("id");
  const existing = await getUserById(c.env.DB, targetUserId);
  if (!existing) {
    return c.json(notFoundResponse("User not found."), 404);
  }

  const body = await c.req.json<{
    assignments?: Array<{ mailboxId?: string; permissions?: string[] }>;
  }>();
  const assignments = Array.isArray(body.assignments) ? body.assignments : [];

  await runStatement(
    c.env.DB,
    `
      DELETE FROM user_mailbox_permissions
      WHERE user_id = ?
    `,
    targetUserId,
  );

  for (const assignment of assignments) {
    const mailboxId = typeof assignment.mailboxId === "string" ? assignment.mailboxId : "";
    const permissions = Array.isArray(assignment.permissions) ? assignment.permissions : [];

    for (const permission of permissions) {
      if (!mailboxId || !["read", "reply", "manage"].includes(permission)) continue;
      await runStatement(
        c.env.DB,
        `
          INSERT INTO user_mailbox_permissions (
            id,
            user_id,
            mailbox_id,
            permission
          ) VALUES (?, ?, ?, ?)
        `,
        createId("ump"),
        targetUserId,
        mailboxId,
        permission,
      );
    }
  }

  await writeUserAuditLog(c.env.DB, adminCheck.userId, targetUserId, "user.permissions.update", {
    mailboxCount: assignments.length,
  });

  return c.json({ ok: true });
});

usersRouter.post("/cloudflare-sync", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const startedAt = Date.now();
    console.log(
      "[cloudflare-sync] http_request_start",
      JSON.stringify({
        userId: adminCheck.userId,
        path: new URL(c.req.url).pathname,
      }),
    );
    const result = await runCloudflareAdminSync(c.env, adminCheck.userId);
    console.log(
      "[cloudflare-sync] http_request_finish",
      JSON.stringify({
        userId: adminCheck.userId,
        path: new URL(c.req.url).pathname,
        durationMs: Date.now() - startedAt,
        totalDomains: result.totalDomains,
        succeededDomains: result.succeededDomains,
        failedDomains: result.failedDomains,
      }),
    );
    return c.json(result);
  } catch (error) {
    reportUsersException(c, error, "cloudflare_sync.start");
    return c.json(
      {
        error: {
          code: "CLOUDFLARE_SYNC_FAILED",
          message: "Cloudflare sync could not start.",
          details:
            error instanceof Error ? error.message : "Unknown Cloudflare sync error.",
        },
      },
      500,
    );
  }
});

usersRouter.post("/alert-test", async (c) => {
  const adminCheck = await requireAdminUser(c);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const testError = new Error("DingTalk webhook self-test");
  scheduleExceptionReport(c.env, getExecutionContextOrNull(c), testError, {
    source: "alert-test",
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    userId: adminCheck.userId,
    step: "manual_self_test",
    details: {
      triggeredBy: "admin",
      note: "This is an intentional test alert.",
    },
  });

  return c.json({
    ok: true,
    message: "Alert test queued.",
  });
});

export { requireAdmin, unauthorizedResponse, forbiddenResponse };
