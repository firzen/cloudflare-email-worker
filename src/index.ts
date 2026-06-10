import { app } from "./app";
import { handleInboundEmail } from "./lib/email/inbound";
import type { Env } from "./types/env";

const worker = {
  fetch: app.fetch,
  email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    return handleInboundEmail(message, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export default worker;
