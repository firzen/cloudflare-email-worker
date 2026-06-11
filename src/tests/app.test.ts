import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("app", () => {
  it("responds to health checks", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("serves the inbox UI shell at the root route", async () => {
    const res = await app.request("/");
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Cloudflare Email Inbox");
    expect(body).toContain("id=\"app-root\"");
    expect(body).toContain("id=\"folder-list\"");
    expect(body).toContain("id=\"settings-button\"");
    expect(body).toContain("id=\"settings-modal\"");
    expect(body).toContain("id=\"settings-tabs\"");
    expect(body).toContain("id=\"settings-tab-workspace\"");
    expect(body).toContain("id=\"settings-tab-users\"");
    expect(body).toContain("id=\"settings-panel-workspace\"");
    expect(body).toContain("id=\"settings-panel-users\"");
    expect(body).toContain("id=\"user-name-input\"");
    expect(body).toContain("id=\"user-email-input\"");
    expect(body).toContain("id=\"user-role-input\"");
    expect(body).toContain("id=\"permission-search-input\"");
    expect(body).toContain("id=\"permission-bulk-read\"");
    expect(body).toContain("id=\"permission-bulk-reply\"");
    expect(body).toContain("id=\"permission-bulk-manage\"");
    expect(body).toContain("id=\"new-user-button\"");
    expect(body).toContain("id=\"delete-user-button\"");
    expect(body).toContain("id=\"run-cloudflare-sync-button\"");
    expect(body).toContain("id=\"cloudflare-sync-results\"");
    expect(body).toContain("id=\"reply-subject\"");
    expect(body).toContain("id=\"reply-attachments\"");
    expect(body).toContain("id=\"toast-region\"");
    expect(body).toContain("new FormData()");
    expect(body).toContain("data.error.step");
    expect(body).toContain("data.error.details");
    expect(body).toContain('!(options.body instanceof FormData)');
    expect(body).toContain('id="message-search" placeholder="Search mail"');
    expect(body).toContain('data-loading-label="Sending..."');
    expect(body).toContain("fld_sent");
    expect(body).toContain("searchQuery");
    expect(body).toContain("outboundMessages");
    expect(body).toContain("matchesSearch(");
    expect(body).toContain("loadSentMessageDetail(");
    expect(body).toContain('"/unread"');
    expect(body).toContain("setButtonLoading(");
    expect(body).toContain("showToast(");
    expect(body).toContain("renderDetailLoading()");
    expect(body).toContain("detail-view loading");
    expect(body).toContain("border-top: 1px solid rgba(227, 231, 238, 0.7);");
    expect(body).not.toContain("margin: 4px 8px;");
    expect(body).not.toContain("box-shadow: 0 16px 28px rgba(61, 125, 246, 0.18);");
    expect(body).toContain(">All<");
    expect(body).not.toContain('id="refresh-button">+');
    expect(body).not.toContain('type="button">⌂</button>');
    expect(body).not.toContain('type="button">≡</button>');
    expect(body).not.toContain('<span class="action-pill">Reply</span>');
    expect(body).not.toContain('<span class="action-pill">Move</span>');
    expect(body).not.toContain('<span class="action-pill">Delete</span>');
    expect(body).not.toContain("Write private comment...");
    expect(body).not.toContain("Details");
    expect(body).not.toContain("id=\"detail-summary\"");
    expect(body).not.toContain("id=\"admin-panel\"");
  });
});
