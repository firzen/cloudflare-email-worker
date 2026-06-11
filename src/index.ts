import { app } from "./app";
import { scheduleExceptionReport } from "./lib/alerts";
import { handleInboundEmail } from "./lib/email/inbound";
import type { Env } from "./types/env";

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await app.fetch(request, env, ctx);
    } catch (error) {
      scheduleExceptionReport(env, ctx, error, {
        source: "fetch-entrypoint",
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return Response.json(
        {
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error.",
          },
        },
        { status: 500 },
      );
    }
  },
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    try {
      return await handleInboundEmail(message, env, ctx);
    } catch (error) {
      scheduleExceptionReport(env, ctx, error, {
        source: "email",
        emailFrom: message.from,
        emailTo: message.to,
        emailSubject: message.headers.get("subject"),
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

export default worker;
