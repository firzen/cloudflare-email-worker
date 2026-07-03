import { app } from "./app";
import { scheduleExceptionReport } from "./lib/alerts";
import { runCloudflareAdminSync } from "./lib/cloudflare/admin-sync";
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
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ) {
    try {
      const result = await runCloudflareAdminSync(env);

      if (result.failedDomains > 0) {
        const failedItems = result.items.filter((item) => item.status === "failed");
        const failedDomainNames = failedItems.map((item) => item.domain);
        scheduleExceptionReport(
          env,
          ctx,
          new Error(
            `Scheduled Cloudflare sync failed for ${result.failedDomains} domain(s): ${failedDomainNames.join(", ")}`,
          ),
          {
            source: "scheduled",
            step: "cloudflare_sync",
            details: {
              cron: controller.cron,
              scheduledTime: controller.scheduledTime,
              totalDomains: result.totalDomains,
              succeededDomains: result.succeededDomains,
              failedDomains: result.failedDomains,
              failedDomainNames,
              failedItems,
            },
          },
        );
      }
    } catch (error) {
      scheduleExceptionReport(env, ctx, error, {
        source: "scheduled",
        step: "cloudflare_sync",
        details: {
          cron: controller.cron,
          scheduledTime: controller.scheduledTime,
        },
      });
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

export default worker;
