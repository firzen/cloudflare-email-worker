import { Hono } from "hono";
import { parseSessionCookie } from "./lib/auth";
import { getExecutionContextOrNull, scheduleExceptionReport } from "./lib/alerts";
import { parseCookieHeader } from "./lib/http";
import { renderInboxPage } from "./lib/ui";
import { auditRouter } from "./routes/audit";
import { authRoutes } from "./routes/auth";
import { foldersRouter } from "./routes/folders";
import { mailboxesRouter } from "./routes/mailboxes";
import { messagesRouter } from "./routes/messages";
import { usersRouter } from "./routes/users";
import type { Env } from "./types/env";

type AppVariables = {
  userId: string | null;
};

export const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", async (c, next) => {
  const { session } = parseCookieHeader(c.req.header("cookie"));
  const appSecret = c.env?.APP_SECRET;
  const userId = session && appSecret ? await parseSessionCookie(session, appSecret) : null;

  c.set("userId", userId);
  await next();
});

app.onError((error, c) => {
  scheduleExceptionReport(c.env, getExecutionContextOrNull(c), error, {
    source: "http",
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    userId: c.get("userId"),
  });

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error.",
      },
    },
    500,
  );
});

app.get("/", (c) => c.html(renderInboxPage()));
app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/audit-logs", auditRouter);
app.route("/api/folders", foldersRouter);
app.route("/api/mailboxes", mailboxesRouter);
app.route("/api/messages", messagesRouter);
app.route("/api/users", usersRouter);
