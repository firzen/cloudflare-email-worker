import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  appFetch,
  handleInboundEmail,
  runCloudflareAdminSync,
  scheduleExceptionReport,
} = vi.hoisted(() => ({
  appFetch: vi.fn(),
  handleInboundEmail: vi.fn(),
  runCloudflareAdminSync: vi.fn(),
  scheduleExceptionReport: vi.fn(),
}));

vi.mock("../app", () => ({
  app: {
    fetch: appFetch,
  },
}));

vi.mock("../lib/email/inbound", () => ({
  handleInboundEmail,
}));

vi.mock("../lib/cloudflare/admin-sync", () => ({
  runCloudflareAdminSync,
}));

vi.mock("../lib/alerts", () => ({
  scheduleExceptionReport,
}));

import worker from "../index";
import type { Env } from "../types/env";

describe("worker entrypoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wires fetch requests to the hono app", async () => {
    const response = new Response("ok");
    const env = {} as Env;
    const ctx = {} as ExecutionContext;
    const request = new Request("https://example.com/health");

    appFetch.mockResolvedValueOnce(response);

    const result = await worker.fetch(request, env, ctx);

    expect(result).toBe(response);
    expect(appFetch).toHaveBeenCalledWith(request, env, ctx);
  });

  it("reports top-level fetch exceptions and returns a 500 response", async () => {
    const env = {
      DINGTALK_WEBHOOK: "https://example.com/robot/send?access_token=test",
    } as Env;
    const ctx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
    const request = new Request("https://example.com/api/messages");

    appFetch.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await worker.fetch(request, env, ctx);

    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    });
    expect(scheduleExceptionReport).toHaveBeenCalledWith(
      env,
      ctx,
      expect.any(Error),
      expect.objectContaining({
        source: "fetch-entrypoint",
        method: "GET",
        path: "/api/messages",
      }),
    );
  });

  it("wires email messages to the inbound handler", async () => {
    const message = {
      headers: new Headers(),
    } as ForwardableEmailMessage;
    const env = {} as Env;
    const ctx = {} as ExecutionContext;

    await worker.email(message, env, ctx);

    expect(handleInboundEmail).toHaveBeenCalledWith(message, env, ctx);
  });

  it("reports email handler exceptions before rethrowing", async () => {
    const message = {
      from: "alice@example.com",
      to: "sales@example.net",
      headers: new Headers([["subject", "Hello"]]),
    } as ForwardableEmailMessage;
    const env = {
      DINGTALK_WEBHOOK: "https://example.com/robot/send?access_token=test",
    } as Env;
    const ctx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;

    handleInboundEmail.mockRejectedValueOnce(new Error("inbound failed"));

    await expect(worker.email(message, env, ctx)).rejects.toThrow("inbound failed");
    expect(scheduleExceptionReport).toHaveBeenCalledWith(
      env,
      ctx,
      expect.any(Error),
      expect.objectContaining({
        source: "email",
        emailFrom: "alice@example.com",
        emailTo: "sales@example.net",
        emailSubject: "Hello",
      }),
    );
  });

  it("runs cloudflare sync for scheduled events", async () => {
    const env = {} as Env;
    const ctx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
    const controller = {
      cron: "0 * * * *",
      scheduledTime: Date.UTC(2026, 5, 18, 3, 0, 0),
    } as ScheduledController;

    runCloudflareAdminSync.mockResolvedValueOnce({
      totalDomains: 1,
      succeededDomains: 1,
      failedDomains: 0,
      items: [],
    });

    await worker.scheduled(controller, env, ctx);

    expect(runCloudflareAdminSync).toHaveBeenCalledWith(env);
    expect(scheduleExceptionReport).not.toHaveBeenCalled();
  });

  it("reports partial scheduled sync failures", async () => {
    const env = {
      DINGTALK_WEBHOOK: "https://example.com/robot/send?access_token=test",
    } as Env;
    const ctx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
    const controller = {
      cron: "0 * * * *",
      scheduledTime: Date.UTC(2026, 5, 18, 4, 0, 0),
    } as ScheduledController;

    runCloudflareAdminSync.mockResolvedValueOnce({
      totalDomains: 2,
      succeededDomains: 1,
      failedDomains: 1,
      items: [
        {
          domain: "example.net",
          zoneId: "zone_2",
          status: "failed",
          actions: ["routing_enabled"],
          failedStep: "email_sending",
          error: "email_sending: missing sending domain",
        },
      ],
    });

    await worker.scheduled(controller, env, ctx);

    expect(scheduleExceptionReport).toHaveBeenCalledWith(
      env,
      ctx,
      expect.any(Error),
      expect.objectContaining({
        source: "scheduled",
        step: "cloudflare_sync",
        details: expect.objectContaining({
          cron: "0 * * * *",
          failedDomains: 1,
          failedDomainNames: ["example.net"],
          failedItems: [
            expect.objectContaining({
              domain: "example.net",
              failedStep: "email_sending",
            }),
          ],
        }),
      }),
    );
  });

  it("reports scheduled sync exceptions before rethrowing", async () => {
    const env = {
      DINGTALK_WEBHOOK: "https://example.com/robot/send?access_token=test",
    } as Env;
    const ctx = {
      waitUntil: vi.fn(),
    } as unknown as ExecutionContext;
    const controller = {
      cron: "0 * * * *",
      scheduledTime: Date.UTC(2026, 5, 18, 5, 0, 0),
    } as ScheduledController;

    runCloudflareAdminSync.mockRejectedValueOnce(new Error("sync exploded"));

    await expect(worker.scheduled(controller, env, ctx)).rejects.toThrow("sync exploded");
    expect(scheduleExceptionReport).toHaveBeenCalledWith(
      env,
      ctx,
      expect.any(Error),
      expect.objectContaining({
        source: "scheduled",
        step: "cloudflare_sync",
        details: expect.objectContaining({
          cron: "0 * * * *",
          scheduledTime: controller.scheduledTime,
        }),
      }),
    );
  });
});
