import type { Env } from "../../types/env";
import { createId } from "../id";
import { parseInboundEmail } from "./parse";
import {
  insertInboundMessage,
  resolveInboundMailbox,
  storeRawInboundEmail,
} from "./storage";

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
