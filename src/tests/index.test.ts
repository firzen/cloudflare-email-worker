import { describe, expect, it, vi } from "vitest";

const { appFetch, handleInboundEmail, scheduleExceptionReport } = vi.hoisted(() => ({
  appFetch: vi.fn(),
  handleInboundEmail: vi.fn(),
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

vi.mock("../lib/alerts", () => ({
  scheduleExceptionReport,
}));

import worker from "../index";
import type { Env } from "../types/env";

describe("worker entrypoint", () => {
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
});
