import { Hono } from "hono";
import { firstRow } from "../lib/db";
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

export const usersRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

usersRouter.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  if (!(await requireAdmin(c.env.DB, userId))) {
    return c.json(forbiddenResponse(), 403);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT id, email, name, role
      FROM users
      WHERE status = 'active'
      ORDER BY email ASC
    `,
  )
    .bind()
    .all();

  return c.json({ items: result.results ?? [] });
});

usersRouter.post("/cloudflare-sync", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  if (!(await requireAdmin(c.env.DB, userId))) {
    return c.json(forbiddenResponse(), 403);
  }

  try {
    const result = await runCloudflareAdminSync(c.env, userId);
    return c.json(result);
  } catch (error) {
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

export { requireAdmin, unauthorizedResponse, forbiddenResponse };
