import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";

describe("audit api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/audit-logs");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns recent audit rows for the authenticated user", async () => {
    const rows = [
      {
        id: "log_2",
        user_id: "usr_1",
        action: "reply_message",
        target_type: "message",
        target_id: "msg_2",
        metadata_json: '{"providerMessageId":"provider-2"}',
        created_at: "2026-06-08T10:00:00.000Z",
      },
      {
        id: "log_1",
        user_id: "usr_1",
        action: "delete_message",
        target_type: "message",
        target_id: "msg_1",
        metadata_json: "{}",
        created_at: "2026-06-08T09:00:00.000Z",
      },
    ];
    const all = vi.fn(async () => ({ results: rows }));
    const bind = vi.fn(() => ({ all }));
    let preparedSql = "";
    const prepare = vi.fn((sql: string) => {
      preparedSql = sql;
      return { bind };
    });
    const cookie = await createSessionCookie("usr_1", "secret");
    const res = await app.request(
      "/api/audit-logs",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        {
          id: "log_2",
          userId: "usr_1",
          action: "reply_message",
          targetType: "message",
          targetId: "msg_2",
          metadata: { providerMessageId: "provider-2" },
          createdAt: "2026-06-08T10:00:00.000Z",
        },
        {
          id: "log_1",
          userId: "usr_1",
          action: "delete_message",
          targetType: "message",
          targetId: "msg_1",
          metadata: {},
          createdAt: "2026-06-08T09:00:00.000Z",
        },
      ],
    });
    expect(preparedSql).toContain("FROM audit_logs");
    expect(preparedSql).toContain("WHERE user_id = ?");
    expect(preparedSql).toContain("ORDER BY created_at DESC");
    expect(preparedSql).toContain("LIMIT 100");
    expect(bind).toHaveBeenCalledWith("usr_1");
    expect(all).toHaveBeenCalledTimes(1);
  });
});
