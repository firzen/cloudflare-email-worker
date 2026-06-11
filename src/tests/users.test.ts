import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";

function createAdminGatePrepare(overrides: {
  all?: (sql: string, params: unknown[]) => Promise<unknown>;
  first?: (sql: string, params: unknown[]) => Promise<unknown>;
  run?: (sql: string, params: unknown[]) => Promise<unknown>;
}) {
  return {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>() {
              if (sql.includes("WHERE id = ?") && sql.includes("AND status = 'active'")) {
                return { id: "usr_admin", role: "admin" } as T;
              }
              if (overrides.first) {
                return (await overrides.first(sql, params)) as T;
              }
              throw new Error(`Unexpected first() query: ${sql}`);
            },
            async all<T>() {
              if (overrides.all) {
                return { results: (await overrides.all(sql, params)) as T[] };
              }
              throw new Error(`Unexpected all() query: ${sql}`);
            },
            async run() {
              if (overrides.run) {
                return overrides.run(sql, params);
              }
              throw new Error(`Unexpected run() query: ${sql}`);
            },
          };
        },
      };
    },
  };
}

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
    const cookie = await createSessionCookie("usr_admin", "secret");
    const db = createAdminGatePrepare({
      all: async (sql) => {
        expect(sql).toContain("SELECT id, email, name, role, status");
        return [
          {
            id: "usr_admin",
            email: "admin@example.com",
            name: "Admin",
            role: "admin",
            status: "active",
          },
          {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "disabled",
          },
        ];
      },
    });

    const res = await app.request(
      "/api/users",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: "usr_admin",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          status: "active",
        },
        {
          id: "usr_ops",
          email: "ops@example.com",
          name: "Ops",
          role: "operator",
          status: "disabled",
        },
      ],
    });
  });

  it("creates a user for admins", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const run = vi.fn(async () => ({ success: true }));
    const db = createAdminGatePrepare({
      run: async (sql) => {
        expect(
          sql.includes("INSERT INTO users") || sql.includes("INSERT INTO audit_logs"),
        ).toBe(true);
        return run();
      },
    });

    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "new.user@example.com",
          name: "New User",
          role: "operator",
          password: "welcome123",
        }),
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    const data = await res.json<{ user: { id: string; email: string; name: string; role: string; status: string } }>();
    expect(data.user.email).toBe("new.user@example.com");
    expect(data.user.name).toBe("New User");
    expect(data.user.role).toBe("operator");
    expect(data.user.status).toBe("active");
    expect(data.user.id).toContain("usr_");
  });

  it("returns a single user for admins", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const db = createAdminGatePrepare({
      first: async (sql, params) => {
        if (sql.includes("SELECT id, email, name, role, status") && sql.includes("WHERE id = ?")) {
          expect(params).toEqual(["usr_ops"]);
          return {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "active",
          };
        }
        throw new Error(`Unexpected first() query: ${sql}`);
      },
    });

    const res = await app.request(
      "/api/users/usr_ops",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: "usr_ops",
        email: "ops@example.com",
        name: "Ops",
        role: "operator",
        status: "active",
      },
    });
  });

  it("updates a user for admins", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const run = vi.fn(async () => ({ success: true }));
    const db = createAdminGatePrepare({
      first: async (sql) => {
        if (sql.includes("SELECT id, email, name, role, status") && sql.includes("WHERE id = ?")) {
          return {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "active",
          };
        }
        throw new Error(`Unexpected first() query: ${sql}`);
      },
      run: async (sql) => {
        expect(
          sql.includes("UPDATE users") || sql.includes("INSERT INTO audit_logs"),
        ).toBe(true);
        return run();
      },
    });

    const res = await app.request(
      "/api/users/usr_ops",
      {
        method: "PUT",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "ops.updated@example.com",
          name: "Ops Updated",
          role: "operator",
          status: "active",
          password: "new-secret",
        }),
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: "usr_ops",
        email: "ops.updated@example.com",
        name: "Ops Updated",
        role: "operator",
        status: "active",
      },
    });
  });

  it("disables a user for admins", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const run = vi.fn(async () => ({ success: true }));
    const db = createAdminGatePrepare({
      first: async (sql) => {
        if (sql.includes("SELECT id, email, name, role, status") && sql.includes("WHERE id = ?")) {
          return {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "active",
          };
        }
        throw new Error(`Unexpected first() query: ${sql}`);
      },
      run: async (sql) => {
        expect(
          sql.includes("UPDATE users") ||
            sql.includes("DELETE FROM user_mailbox_permissions") ||
            sql.includes("INSERT INTO audit_logs"),
        ).toBe(true);
        return run();
      },
    });

    const res = await app.request(
      "/api/users/usr_ops",
      {
        method: "DELETE",
        headers: { cookie: `session=${cookie}` },
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns mailbox permissions for a user", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const db = createAdminGatePrepare({
      first: async (sql) => {
        if (sql.includes("SELECT id, email, name, role, status") && sql.includes("WHERE id = ?")) {
          return {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "active",
          };
        }
        throw new Error(`Unexpected first() query: ${sql}`);
      },
      all: async (sql) => {
        expect(sql).toContain("LEFT JOIN user_mailbox_permissions");
        return [
          { mailbox_id: "mbx_sales", full_address: "sales@example.com", permission: "read" },
          { mailbox_id: "mbx_sales", full_address: "sales@example.com", permission: "reply" },
          { mailbox_id: "mbx_support", full_address: "support@example.com", permission: null },
        ];
      },
    });

    const res = await app.request(
      "/api/users/usr_ops/permissions",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          mailboxId: "mbx_sales",
          fullAddress: "sales@example.com",
          permissions: ["read", "reply"],
        },
        {
          mailboxId: "mbx_support",
          fullAddress: "support@example.com",
          permissions: [],
        },
      ],
    });
  });

  it("replaces mailbox permissions for a user", async () => {
    const cookie = await createSessionCookie("usr_admin", "secret");
    const run = vi.fn(async () => ({ success: true }));
    const db = createAdminGatePrepare({
      first: async (sql) => {
        if (sql.includes("SELECT id, email, name, role, status") && sql.includes("WHERE id = ?")) {
          return {
            id: "usr_ops",
            email: "ops@example.com",
            name: "Ops",
            role: "operator",
            status: "active",
          };
        }
        throw new Error(`Unexpected first() query: ${sql}`);
      },
      run: async (sql) => {
        expect(
          sql.includes("DELETE FROM user_mailbox_permissions") ||
            sql.includes("INSERT INTO user_mailbox_permissions") ||
            sql.includes("INSERT INTO audit_logs"),
        ).toBe(true);
        return run();
      },
    });

    const res = await app.request(
      "/api/users/usr_ops/permissions",
      {
        method: "PUT",
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          assignments: [
            { mailboxId: "mbx_sales", permissions: ["read", "reply"] },
            { mailboxId: "mbx_support", permissions: ["manage"] },
          ],
        }),
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
