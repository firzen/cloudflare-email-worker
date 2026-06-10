import PostalMime from "postal-mime";

export type ParsedInboundEmail = {
  fromEmail: string;
  toEmail: string;
  recipientDomain: string;
  recipientLocalPart: string;
  subject: string;
  messageIdHeader: string | null;
  textBody: string | null;
  htmlBody: string | null;
  snippet: string | null;
  receivedAt: string;
  rawBuffer: ArrayBuffer;
};

export async function parseInboundEmail(
  message: ForwardableEmailMessage,
): Promise<ParsedInboundEmail> {
  const rawBuffer = await new Response(message.raw).arrayBuffer();
  const parsedEmail = await PostalMime.parse(rawBuffer);
  const toEmail = message.to.trim().toLowerCase();
  const [recipientLocalPart, recipientDomain] = splitEmailAddress(toEmail);
  const textBody = normalizeBody(parsedEmail.text);
  const htmlBody = normalizeBody(parsedEmail.html);

  return {
    fromEmail: message.from.trim().toLowerCase(),
    toEmail,
    recipientDomain,
    recipientLocalPart,
    subject: message.headers.get("subject") ?? "",
    messageIdHeader: message.headers.get("message-id"),
    textBody,
    htmlBody,
    snippet: buildSnippet(textBody, htmlBody),
    receivedAt: new Date().toISOString(),
    rawBuffer,
  };
}

function splitEmailAddress(email: string) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) {
    throw new Error(`Invalid inbound recipient address: ${email}`);
  }

  return [email.slice(0, atIndex), email.slice(atIndex + 1)] as const;
}

function normalizeBody(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r\n/gu, "\n").trim();
  return normalized ? normalized : null;
}

function buildSnippet(textBody: string | null, htmlBody: string | null) {
  const source = textBody ?? stripHtml(htmlBody);

  if (!source) {
    return null;
  }

  const compact = source.replace(/\s+/gu, " ").trim();
  if (!compact) {
    return null;
  }

  return compact.slice(0, 240);
}

function stripHtml(html: string | null) {
  if (!html) {
    return null;
  }

  return html.replace(/<[^>]*>/gu, " ");
}
