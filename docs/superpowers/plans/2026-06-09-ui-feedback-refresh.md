# UI Feedback Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the inbox UI so action feedback is clearer, message switching feels smoother, and success/error states are easier to notice while keeping the existing three-column app structure.

**Architecture:** Keep the current server-rendered single-file UI in `src/lib/ui.ts`, but add a small shared client-side interaction layer for button loading state, toast notifications, and detail loading transitions. Update the UI shell tests first, then implement the minimal CSS/DOM/script changes needed to satisfy the new behavior.

**Tech Stack:** TypeScript, Hono, Vitest, inline HTML/CSS/JS rendered from `src/lib/ui.ts`, Wrangler for deployment

---

### Task 1: Lock the UI contract with failing tests

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`

- [ ] **Step 1: Write the failing test expectations for new UI hooks**

Add assertions to `src/tests/app.test.ts` for stable strings that prove the refresh exists:

```ts
expect(body).toContain('id="toast-region"');
expect(body).toContain('id="message-search" placeholder="Search mail"');
expect(body).toContain('data-loading-label="Sending..."');
expect(body).toContain("setButtonLoading(");
expect(body).toContain("showToast(");
expect(body).toContain("renderDetailLoading()");
expect(body).toContain("detail-view loading");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: FAIL because the new toast region, loading helpers, and placeholder strings are not in the current UI output.

- [ ] **Step 3: Leave `src/lib/ui.ts` unchanged until the failure is confirmed**

No production code changes in this task. The purpose is to prove the test catches missing UI refresh behavior.

### Task 2: Add shared UI feedback primitives

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Implement toast and loading primitives in the UI shell**

Add the following elements and helpers to `src/lib/ui.ts`:

```ts
const state = {
  // existing fields...
  detailLoading: false,
  toastTimer: null,
};

function setButtonLoading(button, loading, loadingLabel) {
  if (!button) return;
  if (!button.dataset.baseLabel) {
    button.dataset.baseLabel = button.textContent || "";
  }
  button.disabled = loading;
  button.setAttribute("aria-busy", loading ? "true" : "false");
  button.classList.toggle("is-loading", loading);
  button.textContent = loading ? loadingLabel || button.dataset.loadingLabel || "Working..." : button.dataset.baseLabel;
}

function showToast(message, kind = "success") {
  const region = els.toastRegion;
  if (!region) return;
  region.innerHTML = '<div class="toast toast-' + kind + '">' + escapeHtml(message) + '</div>';
  region.classList.add("visible");
  if (state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    region.classList.remove("visible");
    region.innerHTML = "";
    state.toastTimer = null;
  }, kind === "error" ? 5200 : 2600);
}
```

- [ ] **Step 2: Add the toast container and base CSS states**

Add a persistent toast region near the root shell and CSS for:

```css
.toast-region { position: fixed; top: 20px; right: 20px; display: grid; gap: 10px; pointer-events: none; opacity: 0; transform: translateY(-8px); transition: opacity 160ms ease, transform 160ms ease; }
.toast-region.visible { opacity: 1; transform: translateY(0); }
.toast { min-width: 280px; max-width: 420px; padding: 12px 14px; border-radius: 14px; box-shadow: 0 16px 34px rgba(25, 39, 61, 0.16); border: 1px solid var(--line-strong); background: rgba(255,255,255,0.96); }
.toast-success { border-color: rgba(41,165,108,0.28); }
.toast-error { border-color: rgba(191,74,34,0.24); }
button.is-loading { cursor: progress; }
button:disabled { opacity: 0.68; cursor: not-allowed; transform: none; }
```

- [ ] **Step 3: Run the focused app test to verify it passes**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: PASS with the new UI shell hooks present.

### Task 3: Improve control states and layout polish

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Upgrade button, folder, thread, and field CSS**

In `src/lib/ui.ts`, expand the CSS to add:

```css
.primary-button,
.secondary-button,
.toolbar-button,
.tiny-button,
.round-button,
.settings-button,
.folder-row,
.thread,
.field input,
.field textarea,
.field select {
  transition: transform 140ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.primary-button:hover,
.secondary-button:hover,
.toolbar-button:hover,
.tiny-button:hover,
.round-button:hover,
.settings-button:hover { box-shadow: 0 10px 20px rgba(25, 39, 61, 0.08); }

.primary-button:active,
.secondary-button:active,
.toolbar-button:active,
.tiny-button:active,
.round-button:active,
.settings-button:active { transform: translateY(1px) scale(0.99); }

.field input:focus,
.field textarea:focus,
.field select:focus,
.search-bar:focus-within { outline: none; border-color: var(--accent-line); box-shadow: 0 0 0 4px rgba(61, 125, 246, 0.12); }
```

- [ ] **Step 2: Polish the structural layout without changing app flow**

Adjust the shell and pane styling in `src/lib/ui.ts`:

```css
.shell { grid-template-columns: 196px 320px minmax(620px, 1fr); }
.sidebar { background: linear-gradient(180deg, #f7f8fa 0%, #f3f5f8 100%); }
.conversation-pane { background: linear-gradient(180deg, #fbfcfd 0%, #f8fafc 100%); }
.message-pane { background: linear-gradient(180deg, #fdfefe 0%, #f7f9fc 100%); }
.thread { margin: 4px 8px; border-radius: 14px; border: 1px solid transparent; }
.thread.active { box-shadow: 0 16px 28px rgba(61, 125, 246, 0.18); }
.reply-box { box-shadow: 0 10px 24px rgba(25, 39, 61, 0.05); }
```

- [ ] **Step 3: Fix the search field behavior**

Replace the current search markup:

```html
<input id="message-search" value="Search" />
```

with:

```html
<input id="message-search" placeholder="Search mail" />
```

- [ ] **Step 4: Re-run the app shell test**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: PASS and the HTML now exposes the new placeholder and helper hooks.

### Task 4: Smooth message detail loading and result feedback

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/messages.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Add a detail-loading renderer and loading class**

In `src/lib/ui.ts`, add a helper:

```ts
function renderDetailLoading() {
  els.detailView.className = "detail-view loading";
  els.detailView.innerHTML = '' +
    '<div class="detail-skeleton">' +
      '<div class="skeleton-line skeleton-line-title"></div>' +
      '<div class="skeleton-line"></div>' +
      '<div class="skeleton-line skeleton-line-wide"></div>' +
      '<div class="skeleton-card"></div>' +
    '</div>';
}
```

and matching CSS:

```css
.detail-view.loading { opacity: 0.82; }
.detail-skeleton { display: grid; gap: 12px; padding: 4px; }
.skeleton-line, .skeleton-card { border-radius: 12px; background: linear-gradient(90deg, #eef2f7 0%, #f8fafd 45%, #eef2f7 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
```

- [ ] **Step 2: Make detail fetches render loading before awaiting**

Update `loadMessageDetail` so it sets `state.detailLoading = true`, calls `renderDetailLoading()`, awaits the API call, then restores the final detail view. Keep errors recoverable:

```ts
async function loadMessageDetail(messageId) {
  state.detailLoading = true;
  renderDetailLoading();
  try {
    const data = await api("/api/messages/" + encodeURIComponent(messageId));
    state.selectedMessageDetail = data.item;
    state.detailLoading = false;
    renderDetail(data.item);
  } catch (error) {
    state.detailLoading = false;
    state.selectedMessageDetail = null;
    els.detailView.className = "detail-view";
    els.detailView.innerHTML = '<div class="empty-state">' + escapeHtml(error.message) + '</div>';
    showToast(error.message, "error");
  }
}
```

- [ ] **Step 3: Route action results through both inline status and toast**

Update `runMessageAction` in `src/lib/ui.ts` to:

```ts
async function runMessageAction(path, options, successMessage = "Saved.", button = null) {
  const status = document.getElementById("detail-status");
  try {
    setStatus(status, "Working...");
    setButtonLoading(button, true);
    await api(path, options);
    setStatus(status, successMessage, "success");
    showToast(successMessage, "success");
    await loadWorkspace();
  } catch (error) {
    setStatus(status, error.message, "error");
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}
```

- [ ] **Step 4: Pass concrete buttons and loading labels into actions**

Update the reply and toolbar button handlers in `src/lib/ui.ts` so each action uses a button reference and `data-loading-label`, for example:

```ts
<button class="primary-button" id="reply-button" type="button" data-loading-label="Sending..." style="width:auto;">Send reply</button>
```

and:

```ts
const replyButton = document.getElementById("reply-button");
await runMessageAction("/api/messages/" + encodeURIComponent(item.id) + "/reply", {
  method: "POST",
  body: form,
}, "Reply sent.", replyButton);
```

- [ ] **Step 5: Re-run the focused app shell test**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: PASS with toast hooks, loading helper strings, and detail-loading hooks present.

### Task 5: Finish attachments presentation and full verification

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Run: project test and check commands

- [ ] **Step 1: Replace the attachment summary line with a reusable file-list treatment**

In `src/lib/ui.ts`, update the reply attachment markup from a plain status line to a list container:

```html
<div class="attachment-list empty" id="reply-attachments-list">No files selected.</div>
```

and render selected files as list items:

```ts
replyAttachmentsList.className = "attachment-list" + (files.length ? "" : " empty");
replyAttachmentsList.innerHTML = files.length
  ? files.map((file) => '<div class="attachment-item"><strong>' + escapeHtml(file.name) + '</strong><span>' + escapeHtml(formatFileSize(file.size)) + '</span></div>').join("")
  : "No files selected.";
```

- [ ] **Step 2: Run the targeted UI test, then the full test suite and checks**

Run:

```bash
npm test -- src/tests/app.test.ts
npm test
npm run check
```

Expected:

- `src/tests/app.test.ts` PASS
- full Vitest suite PASS with 0 failures
- type/check command exits 0

- [ ] **Step 3: Deploy the Worker to Cloudflare**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler deploy
```

Expected: Deploy succeeds and prints a new version id for `cloudflare-email-inbox`.

- [ ] **Step 4: Record the deployment result and sanity-check the live shell**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler versions list --name cloudflare-email-inbox
```

Expected: The newest deployed version appears at the top, confirming rollout.
