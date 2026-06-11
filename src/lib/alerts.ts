import type { Env } from "../types/env";

type ExceptionReportContext = {
  source: string;
  method?: string;
  path?: string;
  userId?: string | null;
  requestId?: string | null;
  emailFrom?: string | null;
  emailTo?: string | null;
  emailSubject?: string | null;
  step?: string | null;
  details?: Record<string, unknown> | null;
};

type ExecutionContextLike = Pick<ExecutionContext, "waitUntil">;

const DINGTALK_TEXT_LIMIT = 3500;

export function scheduleExceptionReport(
  env: Env,
  executionCtx: ExecutionContextLike | null | undefined,
  error: unknown,
  context: ExceptionReportContext,
) {
  const task = reportException(env, error, context);
  if (executionCtx) {
    executionCtx.waitUntil(task);
    return;
  }

  void task;
}

export function getExecutionContextOrNull(
  context: { executionCtx: ExecutionContextLike } | null | undefined,
) {
  if (!context) {
    return null;
  }

  try {
    return context.executionCtx;
  } catch {
    return null;
  }
}

export async function reportException(
  env: Env,
  error: unknown,
  context: ExceptionReportContext,
) {
  if (!env.DINGTALK_WEBHOOK) {
    return;
  }

  try {
    const url = await buildSignedWebhookUrl(env.DINGTALK_WEBHOOK, env.DINGTALK_SECRET);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        msgtype: "text",
        text: {
          content: buildAlertText(error, context),
        },
      }),
    });

    if (!response.ok) {
      console.error("DingTalk alert failed.", response.status, response.statusText);
    }
  } catch (alertError) {
    console.error("DingTalk alert failed.", alertError);
  }
}

async function buildSignedWebhookUrl(webhook: string, secret?: string) {
  if (!secret) {
    return webhook;
  }

  const timestamp = Date.now().toString();
  const sign = await createDingTalkSign(timestamp, secret);
  const url = new URL(webhook);
  url.searchParams.set("timestamp", timestamp);
  url.searchParams.set("sign", sign);
  return url.toString();
}

async function createDingTalkSign(timestamp: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}\n${secret}`),
  );
  return arrayBufferToBase64(signature);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function buildAlertText(error: unknown, context: ExceptionReportContext) {
  const lines = [
    "[cloudflare-email-inbox] exception",
    `source: ${context.source}`,
    context.method ? `method: ${context.method}` : null,
    context.path ? `path: ${context.path}` : null,
    context.userId ? `userId: ${context.userId}` : null,
    context.requestId ? `requestId: ${context.requestId}` : null,
    context.emailFrom ? `emailFrom: ${context.emailFrom}` : null,
    context.emailTo ? `emailTo: ${context.emailTo}` : null,
    context.emailSubject ? `emailSubject: ${context.emailSubject}` : null,
    context.step ? `step: ${context.step}` : null,
    `error: ${formatError(error)}`,
    context.details ? `details: ${truncate(JSON.stringify(context.details), 800)}` : null,
    `stack: ${truncate(extractStack(error), 1800)}`,
  ].filter(Boolean);

  return truncate(lines.join("\n"), DINGTALK_TEXT_LIMIT);
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function extractStack(error: unknown) {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  return formatError(error);
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}
