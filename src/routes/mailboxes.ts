import { Hono } from "hono";
import { firstRow, runStatement } from "../lib/db";
import type { Env } from "../types/env";
import { createId } from "../lib/id";
import { forbiddenResponse, requireAdmin, unauthorizedResponse } from "./users";

type AppVariables = {
  userId: string | null;
};

export const mailboxesRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

mailboxesRouter.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT id, full_address
      FROM mailboxes
      WHERE id IN (
        SELECT mailbox_id
        FROM user_mailbox_permissions
        WHERE user_id = ?
      )
      ORDER BY full_address ASC
    `,
  )
    .bind(userId)
    .all();

  return c.json({ items: result.results ?? [] });
});

mailboxesRouter.get("/:id/permissions", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  if (!(await requireAdmin(c.env.DB, userId))) {
    return c.json(forbiddenResponse(), 403);
  }

  const mailboxId = c.req.param("id");
  const result = await c.env.DB.prepare(
    `
      SELECT user_id, permission
      FROM user_mailbox_permissions
      WHERE mailbox_id = ?
      ORDER BY user_id ASC, permission ASC
    `,
  )
    .bind(mailboxId)
    .all<{ user_id: string; permission: string }>();

  const grouped = new Map<string, string[]>();
  for (const row of result.results ?? []) {
    const current = grouped.get(row.user_id) ?? [];
    current.push(row.permission);
    grouped.set(row.user_id, current);
  }

  return c.json({
    items: Array.from(grouped.entries()).map(([assignedUserId, permissions]) => ({
      userId: assignedUserId,
      permissions,
    })),
  });
});

mailboxesRouter.put("/:id/permissions", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  if (!(await requireAdmin(c.env.DB, userId))) {
    return c.json(forbiddenResponse(), 403);
  }

  const mailboxId = c.req.param("id");
  const body = await c.req.json<{
    assignments?: Array<{ userId?: string; permissions?: string[] }>;
  }>();
  const assignments = Array.isArray(body.assignments) ? body.assignments : [];

  await runStatement(
    c.env.DB,
    `
      DELETE FROM user_mailbox_permissions
      WHERE mailbox_id = ?
    `,
    mailboxId,
  );

  for (const assignment of assignments) {
    const assignedUserId = typeof assignment.userId === "string" ? assignment.userId : "";
    const permissions = Array.isArray(assignment.permissions) ? assignment.permissions : [];
    for (const permission of permissions) {
      if (!assignedUserId || !["read", "reply", "manage"].includes(permission)) continue;
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
        assignedUserId,
        mailboxId,
        permission,
      );
    }
  }

  return c.json({ ok: true });
});
