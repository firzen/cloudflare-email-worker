import { describe, expect, it, vi } from "vitest";
import { runCloudflareAdminSync } from "../lib/cloudflare/admin-sync";
import type { Env } from "../types/env";

function createRunOnlyDb() {
  return {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
}

describe("runCloudflareAdminSync", () => {
  it("retries retryable Cloudflare API failures and completes the sync", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [
            {
              id: "zone_1",
              name: "example.com",
              status: "active",
              type: "full",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            success: false,
            errors: [{ message: "temporary outage" }],
          },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            enabled: true,
            status: "ready",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: {
            enabled: true,
            actions: [{ type: "worker", value: ["cloudflare-email-inbox"] }],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [
            {
              id: "snd_1",
              name: "example.com",
              enabled: true,
              return_path_domain: "cf-bounce.example.com",
            },
          ],
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await runCloudflareAdminSync({
      DB: createRunOnlyDb(),
      CLOUDFLARE_ACCOUNT_ID: "acct_1",
      CLOUDFLARE_API_TOKEN: "token_1",
      CLOUDFLARE_WORKER_NAME: "cloudflare-email-inbox",
      BOOTSTRAP_ADMIN_USER_ID: "usr_bootstrap_admin",
    } as Env);

    expect(result).toEqual({
      totalDomains: 1,
      succeededDomains: 1,
      failedDomains: 0,
      items: [
        {
          domain: "example.com",
          zoneId: "zone_1",
          status: "success",
          actions: [
            "routing_verified",
            "catch_all_verified",
            "email_sending_verified",
            "database_synced",
          ],
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not retry non-retryable Cloudflare API failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          result: [
            {
              id: "zone_1",
              name: "example.com",
              status: "active",
              type: "full",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            success: false,
            errors: [{ message: "permission denied" }],
          },
          { status: 403 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await runCloudflareAdminSync({
      DB: createRunOnlyDb(),
      CLOUDFLARE_ACCOUNT_ID: "acct_1",
      CLOUDFLARE_API_TOKEN: "token_1",
      CLOUDFLARE_WORKER_NAME: "cloudflare-email-inbox",
      BOOTSTRAP_ADMIN_USER_ID: "usr_bootstrap_admin",
    } as Env);

    expect(result).toEqual({
      totalDomains: 1,
      succeededDomains: 0,
      failedDomains: 1,
      items: [
        {
          domain: "example.com",
          zoneId: "zone_1",
          status: "failed",
          actions: [],
          failedStep: "cloudflare_api",
          error: "cloudflare_api: permission denied",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
