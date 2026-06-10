import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";
import { createFakeDb } from "./helpers/fake-db";

describe("messages api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/messages");

    expect(res.status).toBe(401);
  });

  it("returns message rows for authenticated users", async () => {
    const rows = [
      {
        id: "msg_2",
        folder_id: "fld_archived",
        subject: "Later message",
        from_email: "bob@example.com",
        to_email: "sales@example.net",
        received_at: "2026-06-06T11:00:00.000Z",
        is_read: 1,
      },
      {
        id: "msg_1",
        folder_id: "fld_inbox",
        subject: "Earlier message",
        from_email: "alice@example.com",
        to_email: "sales@example.net",
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
      },
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
      "/api/messages",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: rows,
    });
    expect(preparedSql).toContain("SELECT id");
    expect(preparedSql).toContain("folder_id");
    expect(preparedSql).toContain("WHERE deleted_at IS NULL");
    expect(preparedSql).toContain("FROM user_mailbox_permissions");
    expect(preparedSql).toContain("ORDER BY received_at DESC, id DESC");
    expect(preparedSql).toContain("LIMIT 50");
    expect(bind).toHaveBeenCalledWith("usr_1");
    expect(all).toHaveBeenCalledTimes(1);
  });

  it("returns only messages from permitted mailboxes", async () => {
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "manage" }],
      messages: [
        {
          id: "msg_visible",
          mailbox_id: "mbx_support",
          folder_id: "fld_inbox",
          from_email: "alice@example.com",
          to_email: "support@example.net",
          subject: "Visible message",
          snippet: null,
          text_body: null,
          html_body: null,
          received_at: "2026-06-06T10:00:00.000Z",
          is_read: 0,
        },
        {
          id: "msg_hidden",
          mailbox_id: "mbx_sales",
          folder_id: "fld_inbox",
          from_email: "bob@example.com",
          to_email: "sales@example.net",
          subject: "Forbidden message",
          snippet: null,
          text_body: null,
          html_body: null,
          received_at: "2026-06-06T11:00:00.000Z",
          is_read: 1,
        },
      ],
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: "msg_visible",
          folder_id: "fld_inbox",
          subject: "Visible message",
          from_email: "alice@example.com",
          to_email: "support@example.net",
          received_at: "2026-06-06T10:00:00.000Z",
          is_read: 0,
        },
      ],
    });
  });

  it("rejects unauthenticated users for message detail", async () => {
    const res = await app.request("/api/messages/msg_1");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns 404 when an authenticated message detail does not exist", async () => {
    const first = vi.fn(async () => null);
    const bind = vi.fn(() => ({ first }));
    let preparedSql = "";
    const prepare = vi.fn((sql: string) => {
      preparedSql = sql;
      return { bind };
    });
    const cookie = await createSessionCookie("usr_1", "secret");
    const res = await app.request(
      "/api/messages/msg_missing",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
    expect(preparedSql).toContain("SELECT");
    expect(preparedSql).toContain("FROM messages");
    expect(preparedSql).toContain("WHERE id = ?");
    expect(preparedSql).toContain("deleted_at IS NULL");
    expect(preparedSql).toContain("FROM user_mailbox_permissions");
    expect(bind).toHaveBeenCalledWith("msg_missing", "usr_1");
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("returns a minimal message detail for authenticated users", async () => {
    const row = {
      id: "msg_1",
      mailbox_id: "mbx_sales",
      folder_id: "fld_inbox",
      from_email: "alice@example.com",
      to_email: "sales@example.net",
      subject: "Hello",
      snippet: "Short preview",
      text_body: "Plain text body",
      html_body: "<p>Plain text body</p>",
      received_at: "2026-06-06T10:00:00.000Z",
      is_read: 0,
    };
    const first = vi.fn(async () => row);
    const all = vi.fn(async () => ({ results: [] }));
    const bind = vi.fn(() => ({ first, all }));
    const preparedSqls: string[] = [];
    const prepare = vi.fn((sql: string) => {
      preparedSqls.push(sql);
      return { bind };
    });
    const cookie = await createSessionCookie("usr_1", "secret");
    const res = await app.request(
      "/api/messages/msg_1",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      item: {
        id: "msg_1",
        mailboxId: "mbx_sales",
        folderId: "fld_inbox",
        fromEmail: "alice@example.com",
        toEmail: "sales@example.net",
        subject: "Hello",
        snippet: "Short preview",
        textBody: "Plain text body",
        htmlBody: "<p>Plain text body</p>",
        receivedAt: "2026-06-06T10:00:00.000Z",
        isRead: false,
        attachments: [],
      },
    });
    const mainSql = preparedSqls[0];
    expect(mainSql).toContain("SELECT");
    expect(mainSql).toContain("mailbox_id");
    expect(mainSql).toContain("folder_id");
    expect(mainSql).toContain("text_body");
    expect(mainSql).toContain("html_body");
    expect(mainSql).toContain("WHERE id = ?");
    expect(mainSql).toContain("FROM user_mailbox_permissions");
    expect(preparedSqls[1]).toContain("message_attachments");
    expect(bind).toHaveBeenCalledWith("msg_1", "usr_1");
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when the message exists but the user is not permitted to read it", async () => {
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
      messages: [
        {
          id: "msg_private",
          mailbox_id: "mbx_sales",
          folder_id: "fld_inbox",
          from_email: "private@example.com",
          to_email: "sales@example.net",
          subject: "Private",
          snippet: "Private preview",
          text_body: "Private body",
          html_body: "<p>Private body</p>",
          received_at: "2026-06-06T10:00:00.000Z",
          is_read: 0,
        },
      ],
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_private",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
  });

  it("rejects unauthenticated users for marking a message read", async () => {
    const res = await app.request("/api/messages/msg_1/read", { method: "POST" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns 404 when marking read for an inaccessible message", async () => {
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
      messages: [
        {
          id: "msg_private",
          mailbox_id: "mbx_sales",
          folder_id: "fld_inbox",
          from_email: "private@example.com",
          to_email: "sales@example.net",
          subject: "Private",
          snippet: null,
          text_body: null,
          html_body: null,
          received_at: "2026-06-06T10:00:00.000Z",
          is_read: 0,
        },
      ],
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_private/read",
      { method: "POST", headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
  });

  it("marks a visible message as read", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Unread",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
        deleted_at: undefined,
      },
    ];
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_1/read",
      { method: "POST", headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(messages[0]?.is_read).toBe(1);
  });

  it("marks a visible message as unread", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Already read",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 1,
        deleted_at: undefined,
      },
    ];
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_1/unread",
      { method: "POST", headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(messages[0]?.is_read).toBe(0);
  });

  it("returns sent outbound messages visible to the user", async () => {
    const rows = [
      {
        id: "out_1",
        from_email: "support@example.net",
        to_email: "alice@example.com",
        subject: "Sent one",
        snippet: "Thanks for writing",
        text_body: "Thanks for writing",
        html_body: null,
        sent_at: "2026-06-09T10:00:00.000Z",
      },
    ];
    const all = vi.fn(async () => ({ results: rows }));
    const bind = vi.fn(() => ({ all }));
    let preparedSql = "";
    const prepare = vi.fn((sql: string) => {
      preparedSql = sql;
      return { bind };
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/sent",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: "out_1",
          folder_id: "fld_sent",
          from_email: "support@example.net",
          to_email: "alice@example.com",
          subject: "Sent one",
          snippet: "Thanks for writing",
          text_body: "Thanks for writing",
          html_body: null,
          received_at: "2026-06-09T10:00:00.000Z",
          is_read: 1,
          message_type: "outbound",
        },
      ],
    });
    expect(preparedSql).toContain("FROM outbound_messages");
    expect(preparedSql).toContain("status = 'sent'");
    expect(preparedSql).toContain("sent_as_mailbox_id IN");
    expect(bind).toHaveBeenCalledWith("usr_reader");
  });

  it("returns sent outbound message detail with attachments", async () => {
    const outboundRow = {
      id: "out_1",
      from_email: "support@example.net",
      to_email: "alice@example.com",
      subject: "Sent one",
      text_body: "Thanks for writing",
      html_body: "<p>Thanks for writing</p>",
      sent_at: "2026-06-09T10:00:00.000Z",
    };
    const attachmentRows = [
      {
        id: "oatt_1",
        filename: "note.txt",
        content_type: "text/plain",
        size_bytes: 123,
      },
    ];
    const first = vi
      .fn()
      .mockResolvedValueOnce(outboundRow)
      .mockResolvedValueOnce(null);
    const all = vi.fn(async () => ({ results: attachmentRows }));
    const bind = vi
      .fn()
      .mockReturnValueOnce({ first })
      .mockReturnValueOnce({ all });
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/sent/out_1",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      item: {
        id: "out_1",
        folderId: "fld_sent",
        messageType: "outbound",
        fromEmail: "support@example.net",
        toEmail: "alice@example.com",
        subject: "Sent one",
        textBody: "Thanks for writing",
        htmlBody: "<p>Thanks for writing</p>",
        receivedAt: "2026-06-09T10:00:00.000Z",
        isRead: true,
        attachments: [
          {
            id: "oatt_1",
            filename: "note.txt",
            contentType: "text/plain",
            sizeBytes: 123,
          },
        ],
      },
    });
  });

  it("rejects unauthenticated users for deleting a message", async () => {
    const res = await app.request("/api/messages/msg_1/delete", { method: "POST" });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns 404 when deleting without manage access", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Protected",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
        deleted_at: undefined,
      },
    ];
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_1/delete",
      { method: "POST", headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
    expect(messages[0]?.deleted_at).toBeUndefined();
  });

  it("moves a managed message into the Deleted folder", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Disposable",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
        deleted_at: undefined,
      },
    ];
    const db = createFakeDb({
      permissions: [{ user_id: "usr_manager", mailbox_id: "mbx_support", permission: "manage" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_manager", "secret");
    const res = await app.request(
      "/api/messages/msg_1/delete",
      { method: "POST", headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(messages[0]?.folder_id).toBe("fld_deleted");
    expect(messages[0]?.deleted_at).toBeUndefined();
  });

  it("rejects unauthenticated users for moving a message", async () => {
    const res = await app.request("/api/messages/msg_1/move", {
      method: "POST",
      body: JSON.stringify({ folderId: "fld_archive" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns 404 when moving without manage access", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Stationary",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
      },
    ];
    const db = createFakeDb({
      permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "reply" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_reader", "secret");
    const res = await app.request(
      "/api/messages/msg_1/move",
      {
        method: "POST",
        body: JSON.stringify({ folderId: "fld_archive" }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
    expect(messages[0]?.folder_id).toBe("fld_inbox");
  });

  it("moves a managed message to the requested folder", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Move me",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
      },
    ];
    const db = createFakeDb({
      folders: [
        { id: "fld_inbox", name: "Inbox", kind: "system" },
        { id: "fld_archive", name: "Archive", kind: "custom" },
      ],
      permissions: [{ user_id: "usr_manager", mailbox_id: "mbx_support", permission: "manage" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_manager", "secret");
    const res = await app.request(
      "/api/messages/msg_1/move",
      {
        method: "POST",
        body: JSON.stringify({ folderId: "fld_archive" }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(messages[0]?.folder_id).toBe("fld_archive");
  });

  it("returns 404 when moving to a folder that does not exist", async () => {
    const messages = [
      {
        id: "msg_1",
        mailbox_id: "mbx_support",
        folder_id: "fld_inbox",
        from_email: "alice@example.com",
        to_email: "support@example.net",
        subject: "Move me",
        snippet: null,
        text_body: null,
        html_body: null,
        received_at: "2026-06-06T10:00:00.000Z",
        is_read: 0,
      },
    ];
    const db = createFakeDb({
      folders: [{ id: "fld_inbox", name: "Inbox", kind: "system" }],
      permissions: [{ user_id: "usr_manager", mailbox_id: "mbx_support", permission: "manage" }],
      messages,
    });
    const cookie = await createSessionCookie("usr_manager", "secret");
    const res = await app.request(
      "/api/messages/msg_1/move",
      {
        method: "POST",
        body: JSON.stringify({ folderId: "fld_missing" }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      { APP_SECRET: "secret", DB: db },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "FOLDER_NOT_FOUND", message: "Folder not found." },
    });
    expect(messages[0]?.folder_id).toBe("fld_inbox");
  });

  it("rejects unauthenticated users for replying to a message", async () => {
    const res = await app.request("/api/messages/msg_1/reply", {
      method: "POST",
      body: JSON.stringify({ textBody: "Thanks." }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns 404 when replying to an inaccessible message", async () => {
    const first = vi.fn(async () => null);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_private/reply",
      {
        method: "POST",
        body: JSON.stringify({ textBody: "Thanks." }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
    });
  });

  it("returns 400 when reply body is empty", async () => {
    const row = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const first = vi.fn(async () => row);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_1/reply",
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

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "INVALID_REPLY_BODY",
        message: "Either textBody, htmlBody, or attachments is required.",
      },
    });
  });

  it("accepts attachment-only replies and persists outbound attachments", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const send = vi.fn(async () => ({ messageId: "cf-message-1" }));
    const run = vi.fn(async () => ({ success: true }));
    const put = vi.fn(async () => ({}));
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const bindRun = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const form = new FormData();
    form.set("subject", "Custom subject");
    form.append(
      "attachments",
      new File(["hello"], "note.txt", { type: "text/plain" }),
    );
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: form,
        headers: {
          cookie: `session=${cookie}`,
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send },
        ATTACHMENTS: { put },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      providerMessageId: "cf-message-1",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Custom subject",
        attachments: [
          expect.objectContaining({
            filename: "note.txt",
            type: "text/plain",
            disposition: "attachment",
            content: expect.any(ArrayBuffer),
          }),
        ],
      }),
    );
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("sends a reply and persists outbound and audit records", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: "<root@example.com>",
    };
    const send = vi.fn(async () => ({ id: "provider-1" }));
    const run = vi.fn(async () => ({ success: true }));
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const bindRun = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: JSON.stringify({
          textBody: "Thanks, we are on it.",
          htmlBody: "<p>Thanks, we are on it.</p>",
        }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      providerMessageId: "provider-1",
    });
    expect(send).toHaveBeenCalledWith({
      from: "support@example.net",
      to: "alice@example.com",
      subject: "Re: Need help",
      text: "Thanks, we are on it.",
      html: "<p>Thanks, we are on it.</p>",
      headers: {
        "In-Reply-To": "<msg-1@example.com>",
        References: "<root@example.com> <msg-1@example.com>",
      },
      attachments: [],
    });
    expect(prepare).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO outbound_messages"),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE outbound_messages"),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("INSERT INTO audit_logs"),
    );
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("uses the provider messageId returned by Cloudflare email sending", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const send = vi.fn(async () => ({ messageId: "cf-message-1" }));
    const run = vi.fn(async () => ({ success: true }));
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const bindRun = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: JSON.stringify({ textBody: "Thanks." }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send },
      },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      providerMessageId: "cf-message-1",
    });
  });

  it("returns a structured error when the email provider send fails", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const send = vi.fn(async () => {
      throw new Error("sending domain is not configured");
    });
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const bindRun = vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: JSON.stringify({ textBody: "Thanks, we are on it." }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send },
      },
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "EMAIL_SEND_FAILED",
        message: "Reply delivery failed.",
        details: "sending domain is not configured",
      },
    });
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO outbound_messages"),
    );
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE outbound_messages"),
    );
  });

  it("marks outbound message as failed when send fails after attachments were stored", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const send = vi.fn(async () => {
      throw new Error("provider rejected attachment");
    });
    const run = vi.fn(async () => ({ success: true }));
    const put = vi.fn(async () => ({}));
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const bindRun = vi.fn(() => ({ run }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const form = new FormData();
    form.set("textBody", "See attachment.");
    form.append(
      "attachments",
      new File(["hello"], "note.txt", { type: "text/plain" }),
    );
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: form,
        headers: {
          cookie: `session=${cookie}`,
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send },
        ATTACHMENTS: { put },
      },
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "EMAIL_SEND_FAILED",
        message: "Reply delivery failed.",
        details: "provider rejected attachment",
      },
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO outbound_messages"),
    );
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE outbound_messages"),
    );
  });

  it("returns a structured error when reply setup fails before sending", async () => {
    const sourceMessage = {
      id: "msg_1",
      mailbox_id: "mbx_support",
      from_email: "alice@example.com",
      to_email: "support@example.net",
      subject: "Need help",
      message_id_header: "<msg-1@example.com>",
      references_header: null,
    };
    const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
    const failingRun = vi.fn(async () => {
      throw new Error("table is locked");
    });
    const bindRun = vi.fn(() => ({ run: failingRun }));
    const prepare = vi
      .fn()
      .mockImplementationOnce(() => ({ bind: bindFirst }))
      .mockImplementation(() => ({ bind: bindRun }));
    const cookie = await createSessionCookie("usr_replier", "secret");
    const res = await app.request(
      "/api/messages/msg_1/reply",
      {
        method: "POST",
        body: JSON.stringify({ textBody: "Thanks." }),
        headers: {
          cookie: `session=${cookie}`,
          "content-type": "application/json",
        },
      },
      {
        APP_SECRET: "secret",
        DB: { prepare },
        EMAIL: { send: vi.fn(async () => ({ messageId: "unused" })) },
        ATTACHMENTS: { put: vi.fn(async () => ({})) },
      },
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: {
        code: "REPLY_INTERNAL_ERROR",
        message: "Reply could not be processed.",
        step: "prepare_outbound",
        details: "table is locked",
      },
    });
  });

  describe("POST /api/messages/send", () => {
    it("rejects unauthenticated users", async () => {
      const res = await app.request("/api/messages/send", {
        method: "POST",
        body: JSON.stringify({ to: "recipient@example.com", textBody: "Hello." }),
        headers: { "content-type": "application/json" },
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    });

    it("returns 404 when the mailbox is not sendable by the user", async () => {
      const db = createFakeDb({
        permissions: [{ user_id: "usr_reader", mailbox_id: "mbx_support", permission: "read" }],
        mailboxes: [{ id: "mbx_support", full_address: "support@example.net" }],
      });
      const cookie = await createSessionCookie("usr_reader", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({ mailboxId: "mbx_support", to: "recipient@example.com", textBody: "Hello." }),
          headers: { cookie: `session=${cookie}`, "content-type": "application/json" },
        },
        { APP_SECRET: "secret", DB: db },
      );

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({
        error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
      });
    });

    it("returns 400 when recipients are empty", async () => {
      const db = createFakeDb({
        permissions: [{ user_id: "usr_sender", mailbox_id: "mbx_support", permission: "reply" }],
        mailboxes: [{ id: "mbx_support", full_address: "support@example.net" }],
      });
      const cookie = await createSessionCookie("usr_sender", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({ mailboxId: "mbx_support", to: "", cc: "", bcc: "", textBody: "Hello." }),
          headers: { cookie: `session=${cookie}`, "content-type": "application/json" },
        },
        { APP_SECRET: "secret", DB: db },
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "INVALID_RECIPIENTS", message: "At least one recipient (to, cc, or bcc) is required." },
      });
    });

    it("returns 400 when send body and attachments are empty", async () => {
      const db = createFakeDb({
        permissions: [{ user_id: "usr_sender", mailbox_id: "mbx_support", permission: "reply" }],
        mailboxes: [{ id: "mbx_support", full_address: "support@example.net" }],
      });
      const cookie = await createSessionCookie("usr_sender", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({ mailboxId: "mbx_support", to: "recipient@example.com" }),
          headers: { cookie: `session=${cookie}`, "content-type": "application/json" },
        },
        { APP_SECRET: "secret", DB: db },
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "INVALID_SEND_BODY", message: "Either textBody, htmlBody, or attachments is required." },
      });
    });

    it("sends a message and persists outbound and audit records", async () => {
      const send = vi.fn(async () => ({ id: "provider-send-1" }));
      const run = vi.fn(async () => ({ success: true }));
      const mailbox = { id: "mbx_support", full_address: "support@example.net" };
      const bindFirst = vi.fn(() => ({ first: vi.fn(async () => mailbox) }));
      const bindRun = vi.fn(() => ({ run }));
      const prepare = vi
        .fn()
        .mockImplementationOnce(() => ({ bind: bindFirst }))
        .mockImplementation(() => ({ bind: bindRun }));
      const cookie = await createSessionCookie("usr_sender", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({
            mailboxId: "mbx_support",
            to: "recipient@example.com",
            cc: "cc@example.com",
            subject: "Hello",
            textBody: "World",
          }),
          headers: {
            cookie: `session=${cookie}`,
            "content-type": "application/json",
          },
        },
        {
          APP_SECRET: "secret",
          DB: { prepare },
          EMAIL: { send },
        },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        providerMessageId: "provider-send-1",
      });
      expect(send).toHaveBeenCalledWith({
        from: "support@example.net",
        to: "recipient@example.com",
        cc: "cc@example.com",
        subject: "Hello",
        text: "World",
        attachments: [],
      });
      expect(prepare).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("INSERT INTO outbound_messages"),
      );
      expect(prepare).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("UPDATE outbound_messages"),
      );
      expect(prepare).toHaveBeenNthCalledWith(
        4,
        expect.stringContaining("INSERT INTO audit_logs"),
      );
      expect(run).toHaveBeenCalledTimes(3);
    });

    it("uses fromPrefix to build the sender address", async () => {
      const send = vi.fn(async () => ({ id: "provider-send-2" }));
      const run = vi.fn(async () => ({ success: true }));
      const mailbox = { id: "mbx_support", full_address: "support@example.net" };
      const bindFirst = vi.fn(() => ({ first: vi.fn(async () => mailbox) }));
      const bindRun = vi.fn(() => ({ run }));
      const prepare = vi
        .fn()
        .mockImplementationOnce(() => ({ bind: bindFirst }))
        .mockImplementation(() => ({ bind: bindRun }));
      const cookie = await createSessionCookie("usr_sender", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({
            mailboxId: "mbx_support",
            fromPrefix: "sam",
            to: "recipient@example.com",
            subject: "Hello",
            textBody: "World",
          }),
          headers: {
            cookie: `session=${cookie}`,
            "content-type": "application/json",
          },
        },
        {
          APP_SECRET: "secret",
          DB: { prepare },
          EMAIL: { send },
        },
      );

      expect(res.status).toBe(200);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "sam@example.net",
          to: "recipient@example.com",
        }),
      );
    });

    it("sends a message with attachments via multipart/form-data", async () => {
      const send = vi.fn(async () => ({ messageId: "cf-send-1" }));
      const run = vi.fn(async () => ({ success: true }));
      const put = vi.fn(async () => ({}));
      const mailbox = { id: "mbx_support", full_address: "support@example.net" };
      const bindFirst = vi.fn(() => ({ first: vi.fn(async () => mailbox) }));
      const bindRun = vi.fn(() => ({ run }));
      const prepare = vi
        .fn()
        .mockImplementationOnce(() => ({ bind: bindFirst }))
        .mockImplementation(() => ({ bind: bindRun }));
      const cookie = await createSessionCookie("usr_sender", "secret");
      const form = new FormData();
      form.set("mailboxId", "mbx_support");
      form.set("to", "recipient@example.com");
      form.set("subject", "With attachment");
      form.set("textBody", "See attached.");
      form.append("attachments", new File(["content"], "doc.txt", { type: "text/plain" }));
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: form,
          headers: { cookie: `session=${cookie}` },
        },
        {
          APP_SECRET: "secret",
          DB: { prepare },
          EMAIL: { send },
          ATTACHMENTS: { put },
        },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        providerMessageId: "cf-send-1",
      });
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "support@example.net",
          to: "recipient@example.com",
          subject: "With attachment",
          text: "See attached.",
        }),
      );
      expect(put).toHaveBeenCalledTimes(1);
    });

    it("returns a structured error when the email provider send fails", async () => {
      const send = vi.fn(async () => {
        throw new Error("sending domain is not configured");
      });
      const run = vi.fn(async () => ({ success: true }));
      const mailbox = { id: "mbx_support", full_address: "support@example.net" };
      const bindFirst = vi.fn(() => ({ first: vi.fn(async () => mailbox) }));
      const bindRun = vi.fn(() => ({ run }));
      const prepare = vi
        .fn()
        .mockImplementationOnce(() => ({ bind: bindFirst }))
        .mockImplementation(() => ({ bind: bindRun }));
      const cookie = await createSessionCookie("usr_sender", "secret");
      const res = await app.request(
        "/api/messages/send",
        {
          method: "POST",
          body: JSON.stringify({
            mailboxId: "mbx_support",
            to: "recipient@example.com",
            textBody: "Hello.",
          }),
          headers: {
            cookie: `session=${cookie}`,
            "content-type": "application/json",
          },
        },
        {
          APP_SECRET: "secret",
          DB: { prepare },
          EMAIL: { send },
        },
      );

      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({
        error: {
          code: "EMAIL_SEND_FAILED",
          message: "Email delivery failed.",
          details: "sending domain is not configured",
        },
      });
      expect(prepare).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO outbound_messages"),
      );
      expect(prepare).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE outbound_messages"),
      );
    });
  });
});
