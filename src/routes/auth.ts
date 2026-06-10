import { Hono } from "hono";
import { createSessionCookie, verifyPassword } from "../lib/auth";
import { firstRow } from "../lib/db";
import { serializeCookie } from "../lib/http";
import type { Env } from "../types/env";

type AppVariables = {
  userId: string | null;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash?: string | null;
};

export const authRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function unauthorizedResponse() {
  return {
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  } as const;
}

function invalidCredentialsResponse() {
  return {
    error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
  } as const;
}

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const user = await firstRow<UserRow>(
    c.env.DB,
    `
      SELECT id, email, name, role, password_hash
      FROM users
      WHERE email = ?
        AND status = 'active'
      LIMIT 1
    `,
    email,
  );

  if (!user || !(await verifyPassword(password, user.password_hash ?? null))) {
    return c.json(invalidCredentialsResponse(), 401);
  }

  const session = await createSessionCookie(user.id, c.env.APP_SECRET);
  c.header(
    "Set-Cookie",
    serializeCookie("session", session, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    }),
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

authRoutes.get("/me", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const user = await firstRow<Omit<UserRow, "password_hash">>(
    c.env.DB,
    `
      SELECT id, email, name, role
      FROM users
      WHERE id = ?
        AND status = 'active'
      LIMIT 1
    `,
    userId,
  );

  if (!user) {
    return c.json(unauthorizedResponse(), 401);
  }

  return c.json({ user });
});

authRoutes.post("/logout", (c) => {
  c.header(
    "Set-Cookie",
    serializeCookie("session", "", {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 0,
    }),
  );

  return c.json({ ok: true });
});
