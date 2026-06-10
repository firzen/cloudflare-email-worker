import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";

const { runCloudflareAdminSync } = vi.hoisted(() => ({
  runCloudflareAdminSync: vi.fn(),
}));

vi.mock("../lib/cloudflare/admin-sync", () => ({
  runCloudflareAdminSync,
}));

describe("cloudflare sync api", () => {
  beforeEach(() => {
    runCloudflareAdminSync.mockReset();
  });

  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/users/cloudflare-sync", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("rejects non-admin users from triggering sync", async () => {
    const first = vi.fn(async () => ({ id: "usr_ops", role: "operator" }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_ops", "secret");

    const res = await app.request(
      "/api/users/cloudflare-sync",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "FORBIDDEN", message: "Admin access required." },
    });
  });

  it("returns summary counts and per-domain results for admins", async () => {
    const roleFirst = vi.fn(async () => ({ id: "usr_admin", role: "admin" }));
    const bindRole = vi.fn(() => ({ first: roleFirst }));
    const prepare = vi.fn(() => ({ bind: bindRole }));
    const cookie = await createSessionCookie("usr_admin", "secret");
    runCloudflareAdminSync.mockResolvedValue({
      totalDomains: 2,
      succeededDomains: 1,
      failedDomains: 1,
      items: [
        {
          domain: "example.com",
          zoneId: "zone_1",
          status: "success",
          actions: ["routing_enabled", "catch_all_bound", "database_synced"],
        },
        {
          domain: "example.net",
          zoneId: "zone_2",
          status: "failed",
          failedStep: "email_sending",
          error: "sending domain is not configured",
          actions: ["routing_enabled"],
        },
      ],
    });

    const res = await app.request(
      "/api/users/cloudflare-sync",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        CLOUDFLARE_ACCOUNT_ID: "acct_1",
        CLOUDFLARE_API_TOKEN: "token_1",
        CLOUDFLARE_WORKER_NAME: "worker_1",
        BOOTSTRAP_ADMIN_USER_ID: "usr_bootstrap_admin",
      } as any,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      totalDomains: 2,
      succeededDomains: 1,
      failedDomains: 1,
      items: [
        {
          domain: "example.com",
          zoneId: "zone_1",
          status: "success",
          actions: ["routing_enabled", "catch_all_bound", "database_synced"],
        },
        {
          domain: "example.net",
          zoneId: "zone_2",
          status: "failed",
          failedStep: "email_sending",
          error: "sending domain is not configured",
          actions: ["routing_enabled"],
        },
      ],
    });
    expect(runCloudflareAdminSync).toHaveBeenCalledWith(
      expect.objectContaining({
        CLOUDFLARE_ACCOUNT_ID: "acct_1",
        CLOUDFLARE_API_TOKEN: "token_1",
        CLOUDFLARE_WORKER_NAME: "worker_1",
      }),
      "usr_admin",
    );
  });
});
