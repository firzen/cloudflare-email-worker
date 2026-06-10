import { describe, expect, it, vi } from "vitest";
import { app } from "../app";
import { createSessionCookie } from "../lib/auth";

describe("folders api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/folders");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  it("returns folder rows for authenticated users", async () => {
    const rows = [
      { id: "fld_inbox", name: "Inbox", kind: "system" },
      { id: "fld_archived", name: "Archived", kind: "system" },
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
      "/api/folders",
      { headers: { cookie: `session=${cookie}` } },
      { APP_SECRET: "secret", DB: { prepare } },
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { id: "fld_archived", name: "Archived", kind: "system" },
        { id: "fld_inbox", name: "Inbox", kind: "system" },
        { id: "fld_sent", name: "Sent", kind: "system" },
      ],
    });
    expect(preparedSql).toContain("SELECT id, name, kind");
    expect(preparedSql).toContain("FROM folders");
    expect(preparedSql).toContain("ORDER BY");
    expect(bind).toHaveBeenCalledWith();
    expect(all).toHaveBeenCalledTimes(1);
  });
});
