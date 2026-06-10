import { Hono } from "hono";
import type { Env } from "../types/env";

type AppVariables = {
  userId: string | null;
};

function unauthorizedResponse() {
  return {
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  } as const;
}

export const auditRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

auditRouter.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT
        id,
        user_id,
        action,
        target_type,
        target_id,
        metadata_json,
        created_at
      FROM audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `,
  )
    .bind(userId)
    .all<{
      id: string;
      user_id: string;
      action: string;
      target_type: string;
      target_id: string;
      metadata_json: string;
      created_at: string;
    }>();

  return c.json({
    items: (result.results ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: safeParseJson(row.metadata_json),
      createdAt: row.created_at,
    })),
  });
});

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}
