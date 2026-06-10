import type { Env } from "../../types/env";
import { createId } from "../id";
import { parseInboundEmail } from "./parse";
import {
  insertInboundAttachment,
  insertInboundMessage,
  resolveInboundMailbox,
  storeRawInboundEmail,
} from "./storage";

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim();
  const safe = trimmed.replace(/[^\w.-]+/gu, "_");
  return safe || "attachment";
}

function attachmentToArrayBuffer(content: ArrayBuffer | Uint8Array | string): ArrayBuffer {
  if (content instanceof ArrayBuffer) {
    return content;
  }
  if (content instanceof Uint8Array) {
    return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
  }
  const encoder = new TextEncoder();
  return encoder.encode(content).buffer as ArrayBuffer;
}

export async function persistInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
) {
  const parsed = await parseInboundEmail(message);
  const resolvedMailbox = await resolveInboundMailbox(env, parsed.toEmail);
  const messageId = createId("msg");
  const rawKey = `raw/${messageId}.eml`;

  await storeRawInboundEmail(env, rawKey, parsed.rawBuffer);

  try {
    await insertInboundMessage(env, {
      messageId,
      mailboxId: resolvedMailbox.mailboxId,
      domainId: resolvedMailbox.domainId,
      fromEmail: parsed.fromEmail,
      toEmail: parsed.toEmail,
      subject: parsed.subject,
      messageIdHeader: parsed.messageIdHeader,
      textBody: parsed.textBody,
      htmlBody: parsed.htmlBody,
      snippet: parsed.snippet,
      receivedAt: parsed.receivedAt,
      rawKey,
    });
  } catch (error) {
    await env.RAW_EMAILS.delete(rawKey);
    throw error;
  }

  for (const attachment of parsed.attachments) {
    const data = attachmentToArrayBuffer(attachment.content);
    const filename = (attachment.filename || "attachment").trim();
    if (!filename || data.byteLength === 0) {
      continue;
    }

    const attachmentId = createId("iat");
    const r2Key = `inbound/${messageId}/${attachmentId}/${sanitizeFilename(filename)}`;

    await env.ATTACHMENTS.put(r2Key, data, {
      httpMetadata: { contentType: attachment.mimeType },
    });

    await insertInboundAttachment(env, {
      id: attachmentId,
      messageId,
      filename,
      contentType: attachment.mimeType || null,
      sizeBytes: data.byteLength,
      contentId: attachment.contentId,
      disposition: attachment.disposition,
      r2Key,
    });
  }

  return { messageId, rawKey };
}

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext,
) {
  void ctx;

  await persistInboundEmail(message, env);
}
