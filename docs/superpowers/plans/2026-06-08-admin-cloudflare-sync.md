# Admin Cloudflare Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only settings action that checks all Cloudflare domains and automatically repairs missing Email Routing Worker bindings, Email Sending domains, and local D1 catch-all mailbox records without aborting on per-domain failures.

**Architecture:** Add a focused Cloudflare sync service inside the Worker that talks to Cloudflare's management API using Worker secrets, then expose it through a new admin route returning structured per-domain results. Reuse the existing settings modal by adding a sync button and results panel that calls the new API and renders summary plus failures.

**Tech Stack:** Hono, Cloudflare Workers fetch API, D1, existing inline UI script, Vitest

---

### Task 1: Add failing API tests for admin sync

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/users.test.ts`
- Create: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/cloudflare-sync.test.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/cloudflare-sync.test.ts`

- [ ] **Step 1: Write the failing admin sync tests**

```ts
it("rejects non-admin users from triggering Cloudflare sync", async () => {
  // POST /api/admin/cloudflare-sync should return 403 for operators
});

it("returns summary counts and per-domain results for admins", async () => {
  // mock the sync service result and assert 200 response payload
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/cloudflare-sync.test.ts`
Expected: FAIL because the route does not exist yet

- [ ] **Step 3: Add a tiny helper seam for route injection**

```ts
export type CloudflareSyncRunner = (env: Env, adminUserId: string) => Promise<CloudflareSyncResult>;
```

- [ ] **Step 4: Re-run the targeted test**

Run: `npm test -- src/tests/cloudflare-sync.test.ts`
Expected: still FAIL, but now only because the route/implementation is missing

### Task 2: Add failing UI coverage for the new admin button

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Write the failing HTML shell assertions**

```ts
it("renders the Cloudflare sync controls in the admin settings modal", async () => {
  // expect sync button id and sync results container id in rendered HTML
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/app.test.ts`
Expected: FAIL because the sync controls are not present

- [ ] **Step 3: Keep the assertions narrow**

```ts
expect(body).toContain('id="run-cloudflare-sync-button"');
expect(body).toContain('id="cloudflare-sync-results"');
```

- [ ] **Step 4: Re-run the targeted test**

Run: `npm test -- src/tests/app.test.ts`
Expected: FAIL remains until the UI is added

### Task 3: Implement Cloudflare sync service and admin route

**Files:**
- Create: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/cloudflare/admin-sync.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/types/env.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/users.ts`
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/app.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/cloudflare-sync.test.ts`

- [ ] **Step 1: Implement the environment bindings needed by the service**

```ts
export type Env = {
  // existing bindings...
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_WORKER_NAME: string;
  BOOTSTRAP_ADMIN_USER_ID: string;
};
```

- [ ] **Step 2: Implement the Cloudflare sync service with per-domain try/catch**

```ts
export async function runCloudflareAdminSync(env: Env, adminUserId: string) {
  // list active/full zones
  // enable email routing if needed
  // ensure catch-all worker rule points to env.CLOUDFLARE_WORKER_NAME
  // ensure email sending subdomain exists
  // upsert D1 domain/mailbox/admin permissions
  // return summary + failures without throwing on single-domain errors
}
```

- [ ] **Step 3: Add the admin POST route**

```ts
usersRouter.post("/cloudflare-sync", async (c) => {
  // auth + admin check
  // call service
  // return structured JSON
});
```

- [ ] **Step 4: Run targeted API tests**

Run: `npm test -- src/tests/cloudflare-sync.test.ts`
Expected: PASS

### Task 4: Add the admin UI trigger and results rendering

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Add sync controls to the admin settings section**

```html
<section class="modal-section" id="cloudflare-sync-section">
  <h3>Cloudflare Sync</h3>
  <button class="secondary-button" id="run-cloudflare-sync-button" type="button">Check and bind domains</button>
  <p class="status" id="cloudflare-sync-status"></p>
  <div id="cloudflare-sync-results"></div>
</section>
```

- [ ] **Step 2: Add client-side fetch + render helpers**

```js
async function runCloudflareSync() {
  const result = await api("/api/users/cloudflare-sync", { method: "POST", body: JSON.stringify({}) });
  renderCloudflareSyncResults(result);
}
```

- [ ] **Step 3: Render summary plus failures without hiding partial success**

```js
// show total, succeeded, failed
// show failed domains with step and message
```

- [ ] **Step 4: Run targeted UI shell tests**

Run: `npm test -- src/tests/app.test.ts`
Expected: PASS

### Task 5: Verify end-to-end and document the new admin sync

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/README.md`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/cloudflare-sync.test.ts`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS with all tests green

- [ ] **Step 2: Run type-checking**

Run: `npm run check`
Expected: PASS with no TypeScript errors

- [ ] **Step 3: Update README with required secrets and admin sync behavior**

```md
- Admin settings now include a Cloudflare sync action
- Required secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_WORKER_NAME, BOOTSTRAP_ADMIN_USER_ID
```

- [ ] **Step 4: Deploy only if network allows**

Run: `NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs" npx wrangler deploy`
Expected: successful upload and a new Worker version id
