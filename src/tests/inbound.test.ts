import { describe, expect, it, vi } from "vitest";
import { persistInboundEmail } from "../lib/email/inbound";

describe("persistInboundEmail", () => {
  it("stores the raw message in R2 and writes message metadata to D1", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bind = vi.fn(() => ({ run }));
    const first = vi.fn(async () => ({
      id: "mbx_sales",
      domain_id: "dom_example_net",
    }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first })) }))
      .mockImplementationOnce(() => ({ bind }));
    const put = vi.fn(async () => undefined);
    const env = {
      RAW_EMAILS: { put, delete: vi.fn() },
      ATTACHMENTS: { put: vi.fn() },
      DB: { prepare },
    } as any;

    const message = {
      from: "alice@example.com",
      to: "sales@example.net",
      headers: new Headers([
        ["subject", "Hello there"],
        ["message-id", "<msg-123@example.com>"],
      ]),
      raw: new Response("raw").body as ReadableStream<Uint8Array>,
    } as ForwardableEmailMessage;

    const result = await persistInboundEmail(message, env);

    expect(result.rawKey).toMatch(/^raw\/msg_[a-z0-9]+\.eml$/u);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledWith(result.rawKey, expect.any(ArrayBuffer));
    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT id, domain_id"),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO messages"),
    );
    expect(bind).toHaveBeenCalledWith(
      result.messageId,
      "mbx_sales",
      "dom_example_net",
      "fld_inbox",
      "alice@example.com",
      "sales@example.net",
      "Hello there",
      "<msg-123@example.com>",
      null,
      null,
      null,
      expect.any(String),
      result.rawKey,
    );
    expect(first).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("persists parsed message bodies and snippet when inbound content is available", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bind = vi.fn(() => ({ run }));
    const first = vi.fn(async () => ({
      id: "mbx_sales",
      domain_id: "dom_example_net",
    }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first })) }))
      .mockImplementationOnce(() => ({ bind }));
    const put = vi.fn(async () => undefined);
    const env = {
      RAW_EMAILS: { put, delete: vi.fn() },
      ATTACHMENTS: { put: vi.fn() },
      DB: { prepare },
    } as any;

    const rawEmail = [
      "From: Alice <alice@example.com>",
      "To: sales@example.net",
      "Subject: Body test",
      "Message-ID: <msg-body@example.com>",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hello support team,",
      "",
      "This is the saved body.",
      "",
    ].join("\r\n");

    const message = {
      from: "alice@example.com",
      to: "sales@example.net",
      headers: new Headers([
        ["subject", "Body test"],
        ["message-id", "<msg-body@example.com>"],
      ]),
      raw: new Response(rawEmail).body as ReadableStream<Uint8Array>,
    } as ForwardableEmailMessage;

    const result = await persistInboundEmail(message, env);

    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("text_body"),
    );
    expect(bind).toHaveBeenCalledWith(
      result.messageId,
      "mbx_sales",
      "dom_example_net",
      "fld_inbox",
      "alice@example.com",
      "sales@example.net",
      "Body test",
      "<msg-body@example.com>",
      "Hello support team,\n\nThis is the saved body.",
      null,
      "Hello support team, This is the saved body.",
      expect.any(String),
      result.rawKey,
    );
  });

  it("falls back to an active catch-all mailbox for the recipient domain", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bindInsert = vi.fn(() => ({ run }));
    const exactLookup = vi.fn(async () => null);
    const catchAllLookup = vi.fn(async () => ({
      id: "mbx_domain_catch_all",
      domain_id: "dom_example_net",
    }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first: exactLookup })) }))
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first: catchAllLookup })) }))
      .mockImplementationOnce(() => ({ bind: bindInsert }));
    const put = vi.fn(async () => undefined);
    const env = {
      RAW_EMAILS: { put, delete: vi.fn() },
      ATTACHMENTS: { put: vi.fn() },
      DB: { prepare },
    } as any;

    const message = {
      from: "alice@example.com",
      to: "anything@example.net",
      headers: new Headers([["subject", "Catch-all hello"]]),
      raw: new Response("raw").body as ReadableStream<Uint8Array>,
    } as ForwardableEmailMessage;

    const result = await persistInboundEmail(message, env);

    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("WHERE full_address = ?"),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("route_type = 'catch_all'"),
    );
    expect(exactLookup).toHaveBeenCalledTimes(1);
    expect(catchAllLookup).toHaveBeenCalledTimes(1);
    expect(bindInsert).toHaveBeenCalledWith(
      result.messageId,
      "mbx_domain_catch_all",
      "dom_example_net",
      "fld_inbox",
      "alice@example.com",
      "anything@example.net",
      "Catch-all hello",
      null,
      null,
      null,
      null,
      expect.any(String),
      result.rawKey,
    );
  });

  it("prefers an exact mailbox over a catch-all mailbox on the same domain", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bindInsert = vi.fn(() => ({ run }));
    const exactLookup = vi.fn(async () => ({
      id: "mbx_exact_sales",
      domain_id: "dom_example_net",
    }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first: exactLookup })) }))
      .mockImplementationOnce(() => ({ bind: bindInsert }));
    const put = vi.fn(async () => undefined);
    const env = {
      RAW_EMAILS: { put, delete: vi.fn() },
      ATTACHMENTS: { put: vi.fn() },
      DB: { prepare },
    } as any;

    const message = {
      from: "alice@example.com",
      to: "sales@example.net",
      headers: new Headers([["subject", "Exact hello"]]),
      raw: new Response("raw").body as ReadableStream<Uint8Array>,
    } as ForwardableEmailMessage;

    const result = await persistInboundEmail(message, env);

    expect(exactLookup).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(bindInsert).toHaveBeenCalledWith(
      result.messageId,
      "mbx_exact_sales",
      "dom_example_net",
      "fld_inbox",
      "alice@example.com",
      "sales@example.net",
      "Exact hello",
      null,
      null,
      null,
      null,
      expect.any(String),
      result.rawKey,
    );
  });

  it("deletes the raw object if the D1 insert fails", async () => {
    const dbError = new Error("insert failed");
    const run = vi.fn(async () => {
      throw dbError;
    });
    const bind = vi.fn(() => ({ run }));
    const first = vi.fn(async () => ({
      id: "mbx_sales",
      domain_id: "dom_example_net",
    }));
    const put = vi.fn(async () => undefined);
    const del = vi.fn(async () => undefined);
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: vi.fn(() => ({ first })) }))
      .mockImplementationOnce(() => ({ bind }));
    const env = {
      RAW_EMAILS: { put, delete: del },
      ATTACHMENTS: { put: vi.fn() },
      DB: { prepare },
    } as any;

    const message = {
      from: "alice@example.com",
      to: "sales@example.net",
      headers: new Headers([["message-id", "<msg-456@example.com>"]]),
      raw: new Response("raw").body as ReadableStream<Uint8Array>,
    } as ForwardableEmailMessage;

    await expect(persistInboundEmail(message, env)).rejects.toThrow("insert failed");

    expect(put).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledTimes(1);
    expect(del).toHaveBeenCalledWith(expect.stringMatching(/^raw\/msg_[a-z0-9]+\.eml$/u));
  });
});
