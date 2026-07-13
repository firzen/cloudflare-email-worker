import { Context, Hono } from "hono";
import { firstRow, runStatement } from "../lib/db";
import { getLoginBranding } from "../lib/login-branding";
import { createId } from "../lib/id";
import type { Env } from "../types/env";

type AppVariables = { userId: string | null };

export const settingsRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function errorResponse(message: string) {
  return { error: { code: "VALIDATION_ERROR", message } } as const;
}

async function requireAdmin(c: Context<{ Bindings: Env; Variables: AppVariables }>) {
  const userId = c.get("userId");
  if (!userId) return null;
  return firstRow<{ id: string }>(
    c.env.DB,
    `SELECT id FROM users WHERE id = ? AND role = 'admin' AND status = 'active' LIMIT 1`,
    userId,
  );
}

settingsRouter.get("/login", async (c) => c.json({ login: await getLoginBranding(c.env?.DB) }));

settingsRouter.put("/login", async (c) => {
  const admin = await requireAdmin(c);
  if (!admin) {
    return c.json(
      { error: { code: c.get("userId") ? "FORBIDDEN" : "UNAUTHORIZED", message: c.get("userId") ? "Admin access required." : "Authentication required." } },
      c.get("userId") ? 403 : 401,
    );
  }

  const body = await c.req.json<{ title?: unknown; description?: unknown }>();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!title) return c.json(errorResponse("Login title is required."), 400);
  if (title.length > 120) return c.json(errorResponse("Login title must be 120 characters or fewer."), 400);
  if (description.length > 500) return c.json(errorResponse("Login description must be 500 characters or fewer."), 400);

  await runStatement(
    c.env.DB,
    `INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
    "login_title",
    title,
  );
  await runStatement(
    c.env.DB,
    `INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`,
    "login_description",
    description,
  );
  await runStatement(
    c.env.DB,
    `INSERT INTO audit_logs (id, user_id, action, target_type, target_id, target_user_id, metadata_json)
     VALUES (?, ?, 'login_branding.update', 'user', ?, ?, ?)`,
    createId("aud"),
    admin.id,
    admin.id,
    admin.id,
    JSON.stringify({ title, description }),
  );

  return c.json({ login: { title, description } });
});
