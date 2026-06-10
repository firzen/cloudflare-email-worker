import type { Env } from "../../types/env";
import { firstRow, runStatement } from "../db";

type ResolvedMailbox = {
  mailboxId: string;
  domainId: string;
};

type InboundMessageRecord = {
  messageId: string;
  mailboxId: string;
  domainId: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  messageIdHeader: string | null;
  textBody: string | null;
  htmlBody: string | null;
  snippet: string | null;
  receivedAt: string;
  rawKey: string;
};

export async function storeRawInboundEmail(
  env: Env,
  rawKey: string,
  rawBuffer: ArrayBuffer,
) {
  await env.RAW_EMAILS.put(rawKey, rawBuffer);
}

export async function resolveInboundMailbox(
  env: Env,
  toEmail: string,
): Promise<ResolvedMailbox> {
  const exactRow = await firstRow<{ id: string; domain_id: string }>(
    env.DB,
    `SELECT id, domain_id
      FROM mailboxes
      WHERE full_address = ?
        AND status = 'active'
      LIMIT 1`,
    toEmail,
  );

  if (exactRow) {
    return {
      mailboxId: exactRow.id,
      domainId: exactRow.domain_id,
    };
  }

  const [, domain] = toEmail.split("@");

  if (domain) {
    const catchAllRow = await firstRow<{ id: string; domain_id: string }>(
      env.DB,
      `SELECT mailboxes.id, mailboxes.domain_id
        FROM mailboxes
        INNER JOIN domains ON domains.id = mailboxes.domain_id
        WHERE domains.domain = ?
          AND domains.status = 'active'
          AND mailboxes.route_type = 'catch_all'
          AND mailboxes.status = 'active'
        LIMIT 1`,
      domain.toLowerCase(),
    );

    if (catchAllRow) {
      return {
        mailboxId: catchAllRow.id,
        domainId: catchAllRow.domain_id,
      };
    }
  }

  throw new Error(`No active mailbox or catch-all route found for ${toEmail}.`);
}

export async function insertInboundMessage(
  env: Env,
  record: InboundMessageRecord,
) {
  await runStatement(
    env.DB,
    `INSERT INTO messages (
      id,
      mailbox_id,
      domain_id,
      folder_id,
      from_email,
      to_email,
      subject,
      message_id_header,
      text_body,
      html_body,
      snippet,
      received_at,
      raw_r2_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.messageId,
    record.mailboxId,
    record.domainId,
    "fld_inbox",
    record.fromEmail,
    record.toEmail,
    record.subject,
    record.messageIdHeader,
    record.textBody,
    record.htmlBody,
    record.snippet,
    record.receivedAt,
    record.rawKey,
  );
}
