import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";
import { createFakeDb } from "./helpers/fake-db";

describe("mailboxes api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/mailboxes");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns mailbox rows for authenticated users", async () => {
    const rows = [
      { id: "mbx_sales", full_address: "sales@example.com" },
      { id: "mbx_support", full_address: "support@example.com" },
    ];
    const all = vi.fn(async () => ({ results: rows }));
    const bind = vi.fn(() => ({ all }));
    let preparedSql = "";
    const prepare = vi.fn((sql: string) => {
      preparedSql = sql;
      return { bind };
    });
    const cookie = await createSessionCookie("usr_1", "secret");
    const res = await app.request(
      "/api/mailboxes",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: rows });
    expect(preparedSql).toContain("SELECT id, full_address");
    expect(preparedSql).toContain("FROM mailboxes");
    expect(preparedSql).toContain("FROM user_mailbox_permissions");
    expect(preparedSql).toContain("ORDER BY");
    expect(bind).toHaveBeenCalledWith("usr_1");
    expect(all).toHaveBeenCalledTimes(1);
  });

  it("returns only permitted mailboxes for authenticated users", async () => {
    const db = createFakeDb({
      mailboxes: [
        { id: "mbx_support", full_address: "support@example.com" },
        { id: "mbx_sales", full_address: "sales@example.com" },
      ],
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "reply" }],
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/mailboxes",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [{ id: "mbx_support", full_address: "support@example.com" }],
    });
  });

  it("rejects non-admin users from reading mailbox permissions", async () => {
    const first = vi.fn(async () => ({ id: "usr_1", role: "operator" }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_1", "secret");

    const res = await app.request(
      "/api/mailboxes/mbx_support/permissions",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Admin access required." },
    });
  });

  it("returns mailbox permission assignments for admins", async () => {
    const roleFirst = vi.fn(async () => ({ id: "usr_admin", role: "admin" }));
    const all = vi.fn(async () => ({
      results: [
        { user_id: "usr_admin", permission: "manage" },
        { user_id: "usr_ops", permission: "read" },
        { user_id: "usr_ops", permission: "reply" },
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
      "/api/mailboxes/mbx_support/permissions",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { userId: "usr_admin", permissions: ["manage"] },
        { userId: "usr_ops", permissions: ["read", "reply"] },
      ],
    });
  });

  it("replaces mailbox permission assignments for admins", async () => {
    const roleFirst = vi.fn(async () => ({ id: "usr_admin", role: "admin" }));
    const run = vi.fn(async () => ({ success: true }));
    const bindRole = vi.fn(() => ({ first: roleFirst }));
    const bindRun = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindRole }))
      .mockImplementationOnce(() => ({ bind: bindRun }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_admin", "secret");

    const res = await app.request(
      "/api/mailboxes/mbx_support/permissions",
      {
        method: "PUT",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          assignments: [
            { userId: "usr_admin", permissions: ["manage"] },
            { userId: "usr_ops", permissions: ["read", "reply"] },
          ],
        }),
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("DELETE FROM user_mailbox_permissions"),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("INSERT INTO user_mailbox_permissions"),
    );
  });
});
