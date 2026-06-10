import { describe, expect, it, vi } from "vitest";

const { handleInboundEmail } = vi.hoisted(() => ({
  handleInboundEmail: vi.fn(),
}));

vi.mock("../lib/email/inbound", () => ({
  handleInboundEmail,
}));

import worker from "../index";
import type { Env } from "../types/env";

describe("worker entrypoint", () => {
  it("wires email messages to the inbound handler", async () => {
    const message = {} as ForwardableEmailMessage;
    const env = {} as Env;
    const ctx = {} as ExecutionContext;

    await worker.email(message, env, ctx);

    expect(handleInboundEmail).toHaveBeenCalledWith(message, env, ctx);
  });
});
