import { runStatement } from "../db";
import { createId } from "../id";
import type { OutboundEmailAttachment } from "../../types/env";

export type PersistedOutboundAttachment = {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  contentId: string | null;
  disposition: string | null;
  r2Key: string;
  data: ArrayBuffer;
};

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim();
  const safe = trimmed.replace(/[^\w.-]+/gu, "_");
  return safe || "attachment";
}

export async function persistOutboundAttachments(
  db: D1Database,
  bucket: R2Bucket,
  outboundMessageId: string,
  attachments: File[],
) {
  const persisted: PersistedOutboundAttachment[] = [];

  for (const attachment of attachments) {
    const filename = attachment.name.trim();
    const data = await attachment.arrayBuffer();

    if (!filename || data.byteLength === 0) {
      throw new Error("INVALID_ATTACHMENT");
    }

    const id = createId("oat");
    const contentType = attachment.type || null;
    const r2Key = `outbound/${outboundMessageId}/${id}/${sanitizeFilename(filename)}`;

    await bucket.put(r2Key, data, {
      httpMetadata: contentType ? { contentType } : undefined,
    });

    await runStatement(
      db,
      `
        INSERT INTO outbound_message_attachments (
          id,
          outbound_message_id,
          filename,
          content_type,
          size_bytes,
          content_id,
          disposition,
          r2_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      outboundMessageId,
      filename,
      contentType,
      data.byteLength,
      null,
      "attachment",
      r2Key,
    );

    persisted.push({
      id,
      filename,
      contentType,
      sizeBytes: data.byteLength,
      contentId: null,
      disposition: "attachment",
      r2Key,
      data,
    });
  }

  return persisted;
}

export function buildOutboundEmailAttachments(
  attachments: PersistedOutboundAttachment[],
): OutboundEmailAttachment[] {
  return attachments.map((attachment) => ({
    filename: attachment.filename,
    content: encodeBase64(attachment.data),
    type: attachment.contentType ?? undefined,
    disposition: attachment.disposition ?? undefined,
  }));
}

function encodeBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
