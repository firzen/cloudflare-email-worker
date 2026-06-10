import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";

describe("users api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/users");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("rejects non-admin users", async () => {
    const first = vi.fn(async () => ({ id: "usr_1", role: "operator" }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_1", "secret");

    const res = await app.request(
      "/api/users",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Admin access required." },
    });
  });

  it("returns users for admins", async () => {
    const roleFirst = vi.fn(async () => ({ id: "usr_admin", role: "admin" }));
    const all = vi.fn(async () => ({
      results: [
        { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "admin" },
        { id: "usr_ops", email: "ops@example.com", name: "Ops", role: "operator" },
      ],
    }));
    const bindRole = vi.fn(() => ({ first: roleFirst }));
    const bindAll = vi.fn(() => ({ all }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindRole }))
      .mockImplementationOnce(() => ({ bind: bindAll }));
    const cookie = await createSessionCookie("usr_admin", "secret");

    const res = await app.request(
      "/api/users",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { id: "usr_admin", email: "admin@example.com", name: "Admin", role: "admin" },
        { id: "usr_ops", email: "ops@example.com", name: "Ops", role: "operator" },
      ],
    });
  });
});
