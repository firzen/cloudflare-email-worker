# Sent, Unread, and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Sent folder backed by outbound mail, support marking inbound mail as unread, and make search filter across all visible inbound and sent mail.

**Architecture:** Keep inbound and outbound storage separate on the backend, expose dedicated outbound list/detail endpoints plus an unread toggle endpoint, then combine inbound and outbound records in the existing single-file client for folder rendering, search, and detail switching. Tests lead the changes so both route behavior and UI hooks stay pinned down.

**Tech Stack:** TypeScript, Hono, Vitest, inline HTML/CSS/JS in `src/lib/ui.ts`, Wrangler

---

### Task 1: Lock backend API changes with failing tests

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/messages.test.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/folders.test.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/messages.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/folders.ts`

- [ ] **Step 1: Add failing tests for Sent folder and unread**

Add tests for:

```ts
it("includes the virtual Sent folder for authenticated users", async () => {
  // expect fld_sent in /api/folders response
});

it("returns sent outbound messages visible to the user", async () => {
  // expect GET /api/messages/sent to return sent rows only
});

it("returns sent outbound message detail with attachments", async () => {
  // expect GET /api/messages/sent/:id to return item.attachments
});

it("marks a visible message as unread", async () => {
  // expect POST /api/messages/:id/unread to flip is_read back to 0
});
```

- [ ] **Step 2: Run the focused route tests to verify they fail**

Run:

```bash
npm test -- src/tests/folders.test.ts src/tests/messages.test.ts
```

Expected: FAIL because the Sent folder, sent APIs, and unread endpoint do not exist yet.

### Task 2: Extend fake DB support and implement backend endpoints

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/helpers/fake-db.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/folders.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/messages.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/messages.test.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/folders.test.ts`

- [ ] **Step 1: Extend the fake DB fixtures for outbound data**

Add fixture support in `src/tests/helpers/fake-db.ts` for:

- `outboundMessages`
- `outboundAttachments`

and handle:

- `GET /api/messages/sent`
- `GET /api/messages/sent/:id`
- `UPDATE messages SET is_read = 0`

- [ ] **Step 2: Add the virtual Sent folder to the folders API**

In `src/routes/folders.ts`, append a virtual item:

```ts
const items = [...(result.results ?? [])];
if (!items.find((folder) => folder.id === "fld_sent")) {
  items.push({ id: "fld_sent", name: "Sent", kind: "system" });
}
```

then sort so existing folder behavior stays stable.

- [ ] **Step 3: Add outbound sent list/detail endpoints and unread endpoint**

In `src/routes/messages.ts`, add:

- `GET /sent`
- `GET /sent/:id`
- `POST /:id/unread`

with permission filtering by `sent_as_mailbox_id IN (SELECT mailbox_id FROM user_mailbox_permissions WHERE user_id = ?)` and sent status filtering by `status = 'sent'`.

- [ ] **Step 4: Re-run the focused route tests**

Run:

```bash
npm test -- src/tests/folders.test.ts src/tests/messages.test.ts
```

Expected: PASS for the new Sent and unread behaviors.

### Task 3: Lock the new UI contract with failing shell tests

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`

- [ ] **Step 1: Add failing shell assertions for Sent and search hooks**

Add assertions for stable strings such as:

```ts
expect(body).toContain("fld_sent");
expect(body).toContain("searchQuery");
expect(body).toContain("outboundMessages");
expect(body).toContain("matchesSearch(");
expect(body).toContain("loadSentMessageDetail(");
expect(body).toContain("Mark unread");
```

- [ ] **Step 2: Run the focused app test to verify it fails**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: FAIL because the client does not yet expose the new state and helper hooks.

### Task 4: Implement Sent, unread toggle UI, and global search

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/sidebar-folders.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/sidebar-folders.test.ts`

- [ ] **Step 1: Add client state for outbound messages, search, and selected type**

In `src/lib/ui.ts`, extend state with:

```ts
outboundMessages: [],
searchQuery: "",
selectedMessageType: "inbound",
```

and load outbound data in `loadWorkspace()`.

- [ ] **Step 2: Add search helpers and global list derivation**

Implement shared helpers in `src/lib/ui.ts`:

```ts
function matchesSearch(item, query) { /* normalize and match fields */ }
function visibleInboundMessages() { /* folder-based when no search */ }
function visibleOutboundMessages() { /* sent folder or search */ }
function visibleMessages() { /* merged result set */ }
```

- [ ] **Step 3: Update sidebar ordering to keep Inbox first and Sent near the top**

In `src/lib/sidebar-folders.ts`, treat `Sent` as a prioritized system folder after `Inbox`.

- [ ] **Step 4: Update message rendering and detail loading by message type**

In `src/lib/ui.ts`:

- make list rows identify inbound vs outbound
- load inbound detail through `loadMessageDetail(...)`
- load sent detail through `loadSentMessageDetail(...)`
- hide reply/move/delete/read controls for outbound detail
- switch the read toggle label between `Mark read` and `Mark unread`

- [ ] **Step 5: Wire the search input**

Add an `input` listener for `message-search` so changing the query re-renders the list, preserves selected detail when possible, and restores normal folder view when cleared.

- [ ] **Step 6: Re-run the focused UI tests**

Run:

```bash
npm test -- src/tests/app.test.ts src/tests/sidebar-folders.test.ts
```

Expected: PASS with the new client hooks and folder ordering.

### Task 5: Full verification and deployment

**Files:**
- Verify changed files only

- [ ] **Step 1: Run the full test suite and type check**

Run:

```bash
npm test
npm run check
```

Expected:

- full Vitest suite PASS with 0 failures
- type check exits 0

- [ ] **Step 2: Deploy to Cloudflare**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler deploy
```

Expected: Deploy succeeds and prints a new version id.

- [ ] **Step 3: Verify the deployed version is listed**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler versions list --name cloudflare-email-inbox
```

Expected: The new version id appears in the remote version list.
