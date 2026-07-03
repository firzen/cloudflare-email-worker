import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie, hashPassword, parseSessionCookie } from "../lib/auth";

describe("auth", () => {
  it("round-trips a session cookie", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");

    expect(await parseSessionCookie(cookie, "secret")).toBe("usr_1");
  });

  it("hashes passwords deterministically", async () => {
    expect(await hashPassword("secret-password")).toBe(
      await hashPassword("secret-password"),
    );
  });
});

describe("auth api", () => {
  it("returns 401 for unauthenticated me requests", async () => {
    const res = await app.request("/api/auth/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("logs in an active user with a matching password and sets the session cookie", async () => {
    const row = {
      id: "usr_1",
      email: "ops@example.com",
      name: "Ops",
      role: "operator",
      password_hash: await hashPassword("correct-horse"),
    };
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "ops@example.com",
          password: "correct-horse",
        }),
        headers: { "content-type": "application/json" },
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: "usr_1",
        email: "ops@example.com",
        name: "Ops",
        role: "operator",
      },
    });
    expect(res.headers.get("set-cookie")).toContain("session=");
    expect(bind).toHaveBeenCalledWith("ops@example.com");
  });

  it("rejects invalid login credentials", async () => {
    const row = {
      id: "usr_1",
      email: "ops@example.com",
      name: "Ops",
      role: "operator",
      password_hash: await hashPassword("correct-horse"),
    };
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: "ops@example.com",
          password: "wrong-password",
        }),
        headers: { "content-type": "application/json" },
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." },
    });
  });

  it("returns the authenticated user from the current session", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");
    const row = {
      id: "usr_1",
      email: "ops@example.com",
      name: "Ops",
      role: "operator",
    };
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    const res = await app.request(
      "/api/auth/me",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: row,
    });
    expect(bind).toHaveBeenCalledWith("usr_1");
  });

  it("clears the session cookie on logout", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");
    const res = await app.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: { cookie: `session=${cookie}` },
      },
      { APP_SECRET: "secret" },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("allows an authenticated user to change their own password", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");
    const row = {
      id: "usr_1",
      email: "ops@example.com",
      name: "Ops",
      role: "operator",
      password_hash: await hashPassword("correct-horse"),
    };
    const run = vi.fn(async () => ({ success: true }));
    const prepare = vi.fn((sql: string) => ({
      bind: (...params: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes("WHERE id = ?") && sql.includes("status = 'active'")) {
            expect(params).toEqual(["usr_1"]);
            return row;
          }
          throw new Error(`Unexpected first() query: ${sql}`);
        }),
        run: vi.fn(async () => {
          expect(
            sql.includes("UPDATE users") || sql.includes("INSERT INTO audit_logs"),
          ).toBe(true);
          return run();
        }),
      }),
    }));

    const res = await app.request(
      "/api/auth/password",
      {
        method: "POST",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "correct-horse",
          newPassword: "new-secret-123",
          confirmPassword: "new-secret-123",
        }),
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects password change when the current password is wrong", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");
    const row = {
      id: "usr_1",
      email: "ops@example.com",
      name: "Ops",
      role: "operator",
      password_hash: await hashPassword("correct-horse"),
    };
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    const res = await app.request(
      "/api/auth/password",
      {
        method: "POST",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "wrong-password",
          newPassword: "new-secret-123",
          confirmPassword: "new-secret-123",
        }),
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Current password is incorrect.",
      },
    });
  });
});
