import { Hono } from "hono";
import { firstRow, runStatement } from "../lib/db";
import type { Env } from "../types/env";
import { createId } from "../lib/id";
import {
  buildOutboundEmailAttachments,
  persistOutboundAttachments,
} from "../lib/email/outbound";

type AppVariables = {
  userId: string | null;
};

export const messagesRouter = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function unauthorizedResponse() {
  return {
    error: { code: "UNAUTHORIZED", message: "Authentication required." },
  } as const;
}

function messageNotFoundResponse() {
  return {
    error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." },
  } as const;
}

function folderNotFoundResponse() {
  return {
    error: { code: "FOLDER_NOT_FOUND", message: "Folder not found." },
  } as const;
}

function invalidReplyBodyResponse() {
  return {
    error: {
      code: "INVALID_REPLY_BODY",
      message: "Either textBody, htmlBody, or attachments is required.",
    },
  } as const;
}

function emailSendFailedResponse(details?: string, message = "Reply delivery failed.") {
  return {
    error: {
      code: "EMAIL_SEND_FAILED",
      message,
      details: details ?? "Unknown email provider error.",
    },
  } as const;
}

function invalidAttachmentResponse() {
  return {
    error: {
      code: "INVALID_ATTACHMENT",
      message: "Each attachment must have a filename and non-empty content.",
    },
  } as const;
}

function replyInternalErrorResponse(step: string, error: unknown) {
  const details = error instanceof Error ? error.message : "Unknown reply processing error.";
  return {
    error: {
      code: "REPLY_INTERNAL_ERROR",
      message: "Reply could not be processed.",
      step,
      details,
    },
  } as const;
}

function invalidSendBodyResponse() {
  return {
    error: {
      code: "INVALID_SEND_BODY",
      message: "Either textBody, htmlBody, or attachments is required.",
    },
  } as const;
}

function sendInternalErrorResponse(step: string, error: unknown) {
  const details = error instanceof Error ? error.message : "Unknown send processing error.";
  return {
    error: {
      code: "SEND_INTERNAL_ERROR",
      message: "Message could not be sent.",
      step,
      details,
    },
  } as const;
}

async function findVisibleMessageForUser(db: D1Database, id: string, userId: string) {
  return firstRow<{ id: string }>(
    db,
    `
      SELECT id
      FROM messages
      WHERE id = ?
        AND deleted_at IS NULL
        AND mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
    `,
    id,
    userId,
  );
}

async function findManageableMessageForUser(db: D1Database, id: string, userId: string) {
  return firstRow<{ id: string }>(
    db,
    `
      SELECT id
      FROM messages
      WHERE id = ?
        AND deleted_at IS NULL
        AND mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
            AND permission = 'manage'
        )
    `,
    id,
    userId,
  );
}

async function findFolderById(db: D1Database, id: string) {
  return firstRow<{ id: string }>(
    db,
    `
      SELECT id
      FROM folders
      WHERE id = ?
    `,
    id,
  );
}

type ReplyableMessageRow = {
  id: string;
  mailbox_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  message_id_header: string | null;
  references_header: string | null;
};

async function findReplyableMessageForUser(db: D1Database, id: string, userId: string) {
  return firstRow<ReplyableMessageRow>(
    db,
    `
      SELECT
        id,
        mailbox_id,
        from_email,
        to_email,
        subject,
        message_id_header,
        references_header
      FROM messages
      WHERE id = ?
        AND deleted_at IS NULL
        AND mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
            AND permission IN ('reply', 'manage')
        )
    `,
    id,
    userId,
  );
}

type SendableMailboxRow = {
  id: string;
  full_address: string;
};

async function findSendableMailboxForUser(db: D1Database, mailboxId: string, userId: string) {
  return firstRow<SendableMailboxRow>(
    db,
    `
      SELECT
        id,
        full_address
      FROM mailboxes
      WHERE id = ?
        AND id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
            AND permission IN ('reply', 'manage')
        )
    `,
    mailboxId,
    userId,
  );
}

type SentMessageListRow = {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  snippet: string | null;
  text_body: string | null;
  html_body: string | null;
  sent_at: string;
};

type SentMessageDetailRow = {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  sent_at: string;
};

type OutboundAttachmentRow = {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
};

type InboundAttachmentRow = {
  id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  r2_key: string;
};

function buildReplySubject(subject: string) {
  return /^re:/iu.test(subject) ? subject : `Re: ${subject}`;
}

function buildReplyHeaders(message: ReplyableMessageRow) {
  const headers: Record<string, string> = {};

  if (message.message_id_header) {
    headers["In-Reply-To"] = message.message_id_header;
    headers.References = message.references_header
      ? `${message.references_header} ${message.message_id_header}`
      : message.message_id_header;
  }

  return headers;
}

type ParsedSendRequest = {
  mailboxId: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  attachments: File[];
};

async function parseSendRequest(request: Request): Promise<ParsedSendRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const attachments = form
      .getAll("attachments")
      .filter((value): value is File => value instanceof File);

    return {
      mailboxId: typeof form.get("mailboxId") === "string" ? String(form.get("mailboxId")).trim() : "",
      to: typeof form.get("to") === "string" ? String(form.get("to")).trim() : "",
      cc: typeof form.get("cc") === "string" ? String(form.get("cc")).trim() : "",
      bcc: typeof form.get("bcc") === "string" ? String(form.get("bcc")).trim() : "",
      subject: typeof form.get("subject") === "string" ? String(form.get("subject")).trim() : "",
      textBody:
        typeof form.get("textBody") === "string" ? String(form.get("textBody")).trim() : "",
      htmlBody:
        typeof form.get("htmlBody") === "string" ? String(form.get("htmlBody")).trim() : "",
      attachments,
    };
  }

  const body = await request.json<{
    mailboxId?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    textBody?: string;
    htmlBody?: string;
  }>();
  return {
    mailboxId: typeof body.mailboxId === "string" ? body.mailboxId.trim() : "",
    to: typeof body.to === "string" ? body.to.trim() : "",
    cc: typeof body.cc === "string" ? body.cc.trim() : "",
    bcc: typeof body.bcc === "string" ? body.bcc.trim() : "",
    subject: typeof body.subject === "string" ? body.subject.trim() : "",
    textBody: typeof body.textBody === "string" ? body.textBody.trim() : "",
    htmlBody: typeof body.htmlBody === "string" ? body.htmlBody.trim() : "",
    attachments: [],
  };
}

messagesRouter.get("/", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT id, folder_id, subject, from_email, to_email, snippet, text_body, html_body, received_at, is_read
      FROM messages
      WHERE deleted_at IS NULL
        AND mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
      ORDER BY received_at DESC, id DESC
      LIMIT 50
    `,
  )
    .bind(userId)
    .all();

  return c.json({ items: result.results ?? [] });
});

messagesRouter.get("/sent", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const result = await c.env.DB.prepare(
    `
      SELECT
        id,
        from_email,
        to_email,
        subject,
        COALESCE(text_body, html_body, '') AS snippet,
        text_body,
        html_body,
        sent_at
      FROM outbound_messages
      WHERE status = 'sent'
        AND sent_at IS NOT NULL
        AND sent_as_mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
      ORDER BY sent_at DESC, id DESC
      LIMIT 50
    `,
  )
    .bind(userId)
    .all<SentMessageListRow>();

  return c.json({
    items: (result.results ?? []).map((message) => ({
      id: message.id,
      folder_id: "fld_sent",
      subject: message.subject,
      from_email: message.from_email,
      to_email: message.to_email,
      snippet: message.snippet,
      text_body: message.text_body,
      html_body: message.html_body,
      received_at: message.sent_at,
      is_read: 1,
      message_type: "outbound",
    })),
  });
});

messagesRouter.get("/sent/:id", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await firstRow<SentMessageDetailRow>(
    c.env.DB,
    `
      SELECT
        id,
        from_email,
        to_email,
        subject,
        text_body,
        html_body,
        sent_at
      FROM outbound_messages
      WHERE id = ?
        AND status = 'sent'
        AND sent_at IS NOT NULL
        AND sent_as_mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
    `,
    id,
    userId,
  );

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const attachmentsResult = await c.env.DB.prepare(
    `
      SELECT id, filename, content_type, size_bytes
      FROM outbound_message_attachments
      WHERE outbound_message_id = ?
      ORDER BY created_at ASC, id ASC
    `,
  )
    .bind(id)
    .all<OutboundAttachmentRow>();

  return c.json({
    item: {
      id: message.id,
      folderId: "fld_sent",
      messageType: "outbound",
      fromEmail: message.from_email,
      toEmail: message.to_email,
      subject: message.subject,
      textBody: message.text_body,
      htmlBody: message.html_body,
      receivedAt: message.sent_at,
      isRead: true,
      attachments: (attachmentsResult.results ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        sizeBytes: attachment.size_bytes,
      })),
    },
  });
});

type MessageDetailRow = {
  id: string;
  mailbox_id: string;
  folder_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  snippet: string | null;
  text_body: string | null;
  html_body: string | null;
  received_at: string;
  is_read: number;
};

messagesRouter.get("/:id", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await firstRow<MessageDetailRow>(
    c.env.DB,
    `
      SELECT
        id,
        mailbox_id,
        folder_id,
        from_email,
        to_email,
        subject,
        snippet,
        text_body,
        html_body,
        received_at,
        is_read
      FROM messages
      WHERE id = ?
        AND deleted_at IS NULL
        AND mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
    `,
    id,
    userId,
  );

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const attachmentsResult = await c.env.DB.prepare(
    `
      SELECT id, filename, content_type, size_bytes
      FROM message_attachments
      WHERE message_id = ?
      ORDER BY created_at ASC, id ASC
    `,
  )
    .bind(id)
    .all<InboundAttachmentRow>();

  return c.json({
    item: {
      id: message.id,
      mailboxId: message.mailbox_id,
      folderId: message.folder_id,
      fromEmail: message.from_email,
      toEmail: message.to_email,
      subject: message.subject,
      snippet: message.snippet,
      textBody: message.text_body,
      htmlBody: message.html_body,
      receivedAt: message.received_at,
      isRead: Boolean(message.is_read),
      attachments: (attachmentsResult.results ?? []).map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        sizeBytes: attachment.size_bytes,
      })),
    },
  });
});

messagesRouter.get("/sent/:id/attachments/:attachmentId", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");

  const message = await firstRow<{ id: string }>(
    c.env.DB,
    `
      SELECT id
      FROM outbound_messages
      WHERE id = ?
        AND status = 'sent'
        AND sent_at IS NOT NULL
        AND sent_as_mailbox_id IN (
          SELECT mailbox_id
          FROM user_mailbox_permissions
          WHERE user_id = ?
        )
    `,
    id,
    userId,
  );

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const attachment = await firstRow<{ id: string; filename: string; content_type: string | null; r2_key: string }>(
    c.env.DB,
    `
      SELECT id, filename, content_type, r2_key
      FROM outbound_message_attachments
      WHERE id = ? AND outbound_message_id = ?
    `,
    attachmentId,
    id,
  );

  if (!attachment) {
    return c.json({ error: { code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found." } }, 404);
  }

  const object = await c.env.ATTACHMENTS.get(attachment.r2_key);
  if (!object) {
    return c.json({ error: { code: "ATTACHMENT_NOT_FOUND", message: "Attachment content not found." } }, 404);
  }

  const headers: Record<string, string> = {
    "Content-Type": attachment.content_type || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${attachment.filename}"`,
  };

  if (object.httpEtag) {
    headers.ETag = object.httpEtag;
  }

  return new Response(object.body, { headers });
});

messagesRouter.get("/:id/attachments/:attachmentId", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const attachmentId = c.req.param("attachmentId");

  const message = await findVisibleMessageForUser(c.env.DB, id, userId);
  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const attachment = await firstRow<{ id: string; filename: string; content_type: string | null; r2_key: string }>(
    c.env.DB,
    `
      SELECT id, filename, content_type, r2_key
      FROM message_attachments
      WHERE id = ? AND message_id = ?
    `,
    attachmentId,
    id,
  );

  if (!attachment) {
    return c.json({ error: { code: "ATTACHMENT_NOT_FOUND", message: "Attachment not found." } }, 404);
  }

  const object = await c.env.ATTACHMENTS.get(attachment.r2_key);
  if (!object) {
    return c.json({ error: { code: "ATTACHMENT_NOT_FOUND", message: "Attachment content not found." } }, 404);
  }

  const headers: Record<string, string> = {
    "Content-Type": attachment.content_type || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${attachment.filename}"`,
  };

  if (object.httpEtag) {
    headers.ETag = object.httpEtag;
  }

  return new Response(object.body, { headers });
});

messagesRouter.post("/:id/read", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await findVisibleMessageForUser(c.env.DB, id, userId);

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  await runStatement(
    c.env.DB,
    `
      UPDATE messages
      SET is_read = 1
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    id,
  );

  return c.json({ ok: true });
});

messagesRouter.post("/:id/unread", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await findVisibleMessageForUser(c.env.DB, id, userId);

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  await runStatement(
    c.env.DB,
    `
      UPDATE messages
      SET is_read = 0
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    id,
  );

  return c.json({ ok: true });
});

messagesRouter.post("/:id/delete", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await findManageableMessageForUser(c.env.DB, id, userId);

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  await runStatement(
    c.env.DB,
    `
      UPDATE messages
      SET folder_id = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    "fld_deleted",
    id,
  );

  return c.json({ ok: true });
});

messagesRouter.post("/:id/move", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await findManageableMessageForUser(c.env.DB, id, userId);

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const body = await c.req.json<{ folderId?: string }>();
  const folderId = typeof body.folderId === "string" ? body.folderId : "";

  if (!folderId) {
    return c.json(
      { error: { code: "INVALID_FOLDER_ID", message: "folderId is required." } },
      400,
    );
  }

  const folder = await findFolderById(c.env.DB, folderId);
  if (!folder) {
    return c.json(folderNotFoundResponse(), 404);
  }

  await runStatement(
    c.env.DB,
    `
      UPDATE messages
      SET folder_id = ?
      WHERE id = ?
        AND deleted_at IS NULL
    `,
    folderId,
    id,
  );

  return c.json({ ok: true });
});

messagesRouter.post("/send", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  let sendReq: ParsedSendRequest;
  try {
    sendReq = await parseSendRequest(c.req.raw);
  } catch (error) {
    return c.json(sendInternalErrorResponse("parse_request", error), 500);
  }

  const mailboxId = sendReq.mailboxId;
  const mailbox = mailboxId ? await findSendableMailboxForUser(c.env.DB, mailboxId, userId) : null;

  if (!mailbox) {
    return c.json(messageNotFoundResponse(), 404);
  }

  const toRecipients = sendReq.to
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ccRecipients = sendReq.cc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const bccRecipients = sendReq.bcc
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (toRecipients.length === 0 && ccRecipients.length === 0 && bccRecipients.length === 0) {
    return c.json(
      { error: { code: "INVALID_RECIPIENTS", message: "At least one recipient (to, cc, or bcc) is required." } },
      400,
    );
  }

  const textBody = sendReq.textBody;
  const htmlBody = sendReq.htmlBody;
  const finalSubject = sendReq.subject;

  if (!textBody && !htmlBody && sendReq.attachments.length === 0) {
    return c.json(invalidSendBodyResponse(), 400);
  }

  if (sendReq.attachments.some((attachment) => !attachment.name.trim() || attachment.size === 0)) {
    return c.json(invalidAttachmentResponse(), 400);
  }

  const outboundMessageId = createId("out");
  const sentAt = new Date().toISOString();

  const allRecipients = [...toRecipients, ...ccRecipients, ...bccRecipients];
  const primaryTo = toRecipients[0] ?? allRecipients[0];

  try {
    await runStatement(
      c.env.DB,
      `
        INSERT INTO outbound_messages (
          id,
          reply_to_message_id,
          sent_by_user_id,
          sent_as_mailbox_id,
          from_email,
          to_email,
          cc_json,
          bcc_json,
          subject,
          text_body,
          html_body,
          in_reply_to_header,
          references_header,
          provider_message_id,
          status,
          error_message,
          sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      outboundMessageId,
      null,
      userId,
      mailbox.id,
      mailbox.full_address,
      primaryTo,
      JSON.stringify(ccRecipients),
      JSON.stringify(bccRecipients),
      finalSubject,
      textBody || null,
      htmlBody || null,
      null,
      null,
      null,
      "pending",
      null,
      null,
    );
  } catch (error) {
    return c.json(sendInternalErrorResponse("prepare_outbound", error), 500);
  }

  let persistedAttachments;
  try {
    persistedAttachments = await persistOutboundAttachments(
      c.env.DB,
      c.env.ATTACHMENTS,
      outboundMessageId,
      sendReq.attachments,
    );
  } catch (error) {
    return c.json(sendInternalErrorResponse("persist_attachments", error), 500);
  }

  let providerResult: { id?: string; messageId?: string } | void = undefined;

  const emailPayload: import("../types/env").OutboundEmailPayload = {
    from: mailbox.full_address,
    to: toRecipients.length === 1 ? toRecipients[0] : toRecipients.length > 0 ? toRecipients.join(", ") : primaryTo,
    subject: finalSubject,
    text: textBody || undefined,
    attachments: buildOutboundEmailAttachments(persistedAttachments),
  };

  if (ccRecipients.length > 0) {
    emailPayload.cc = ccRecipients.join(", ");
  }
  if (bccRecipients.length > 0) {
    emailPayload.bcc = bccRecipients.join(", ");
  }
  if (htmlBody) {
    emailPayload.html = htmlBody;
  }

  try {
    providerResult = await c.env.EMAIL.send(emailPayload);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown email provider error.";
    await runStatement(
      c.env.DB,
      `
        UPDATE outbound_messages
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      "failed",
      details,
      outboundMessageId,
    );
    return c.json(emailSendFailedResponse(details, "Email delivery failed."), 502);
  }

  const providerMessageId = providerResult?.messageId ?? providerResult?.id ?? null;

  await runStatement(
    c.env.DB,
    `
      UPDATE outbound_messages
      SET provider_message_id = ?, status = ?, error_message = NULL, sent_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    providerMessageId,
    "sent",
    sentAt,
    outboundMessageId,
  );

  await runStatement(
    c.env.DB,
    `
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        target_type,
        target_id,
        message_id,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    createId("log"),
    userId,
    "send_message",
    "outbound_message",
    outboundMessageId,
    outboundMessageId,
    JSON.stringify({
      outboundMessageId,
      providerMessageId,
      fromEmail: mailbox.full_address,
      toEmail: primaryTo,
      cc: ccRecipients,
      bcc: bccRecipients,
      sentAsMailboxId: mailbox.id,
      attachmentCount: persistedAttachments.length,
      attachments: persistedAttachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      })),
    }),
  );

  return c.json({ ok: true, providerMessageId });
});

messagesRouter.post("/:id/reply", async (c) => {
  const userId = c.get("userId");

  if (!userId) {
    return c.json(unauthorizedResponse(), 401);
  }

  const id = c.req.param("id");
  const message = await findReplyableMessageForUser(c.env.DB, id, userId);

  if (!message) {
    return c.json(messageNotFoundResponse(), 404);
  }

  let reply: ParsedSendRequest;
  try {
    reply = await parseSendRequest(c.req.raw);
  } catch (error) {
    return c.json(replyInternalErrorResponse("parse_request", error), 500);
  }

  const textBody = reply.textBody;
  const htmlBody = reply.htmlBody;
  const finalSubject = reply.subject || buildReplySubject(message.subject);

  if (!textBody && !htmlBody && reply.attachments.length === 0) {
    return c.json(invalidReplyBodyResponse(), 400);
  }

  if (reply.attachments.some((attachment) => !attachment.name.trim() || attachment.size === 0)) {
    return c.json(invalidAttachmentResponse(), 400);
  }

  const outboundMessageId = createId("out");
  const sentAt = new Date().toISOString();

  try {
    await runStatement(
      c.env.DB,
      `
        INSERT INTO outbound_messages (
          id,
          reply_to_message_id,
          sent_by_user_id,
          sent_as_mailbox_id,
          from_email,
          to_email,
          cc_json,
          bcc_json,
          subject,
          text_body,
          html_body,
          in_reply_to_header,
          references_header,
          provider_message_id,
          status,
          error_message,
          sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      outboundMessageId,
      message.id,
      userId,
      message.mailbox_id,
      message.to_email,
      message.from_email,
      "[]",
      "[]",
      finalSubject,
      textBody || null,
      htmlBody || null,
      message.message_id_header,
      buildReplyHeaders(message).References ?? null,
      null,
      "pending",
      null,
      null,
    );
  } catch (error) {
    return c.json(replyInternalErrorResponse("prepare_outbound", error), 500);
  }

  let persistedAttachments;
  try {
    persistedAttachments = await persistOutboundAttachments(
      c.env.DB,
      c.env.ATTACHMENTS,
      outboundMessageId,
      reply.attachments,
    );
  } catch (error) {
    return c.json(replyInternalErrorResponse("persist_attachments", error), 500);
  }

  let providerResult: { id?: string; messageId?: string } | void = undefined;

  try {
    providerResult = await c.env.EMAIL.send({
      from: message.to_email,
      to: message.from_email,
      subject: finalSubject,
      text: textBody || undefined,
      html: htmlBody || undefined,
      headers: buildReplyHeaders(message),
      attachments: buildOutboundEmailAttachments(persistedAttachments),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown email provider error.";
    await runStatement(
      c.env.DB,
      `
        UPDATE outbound_messages
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      "failed",
      details,
      outboundMessageId,
    );
    return c.json(emailSendFailedResponse(details), 502);
  }

  const providerMessageId =
    providerResult?.messageId ?? providerResult?.id ?? null;

  await runStatement(
    c.env.DB,
    `
      UPDATE outbound_messages
      SET provider_message_id = ?, status = ?, error_message = NULL, sent_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    providerMessageId,
    "sent",
    sentAt,
    outboundMessageId,
  );

  await runStatement(
    c.env.DB,
    `
      INSERT INTO audit_logs (
        id,
        user_id,
        action,
        target_type,
        target_id,
        message_id,
        metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    createId("log"),
    userId,
    "reply_message",
    "message",
    message.id,
    message.id,
    JSON.stringify({
      outboundMessageId,
      providerMessageId,
      fromEmail: message.to_email,
      toEmail: message.from_email,
      sentAsMailboxId: message.mailbox_id,
      attachmentCount: persistedAttachments.length,
      attachments: persistedAttachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
      })),
    }),
  );

  return c.json({ ok: true, providerMessageId });
});
