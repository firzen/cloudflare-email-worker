# Thread List Flat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the middle message list from card-like rows to flatter full-width list rows while preserving the blue active state.

**Architecture:** This is a CSS-only refresh inside `src/lib/ui.ts` with a small shell test update in `src/tests/app.test.ts`. No rendering logic or API behavior changes are required.

**Tech Stack:** TypeScript, Vitest, inline HTML/CSS/JS UI

---

### Task 1: Lock the flatter list style with a failing test

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
- Read: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`

- [ ] **Step 1: Add assertions that reject the current card-like row CSS**

Add shell assertions such as:

```ts
expect(body).toContain(".thread + .thread {");
expect(body).toContain("border-top: 1px solid rgba(227, 231, 238, 0.7);");
expect(body).not.toContain("margin: 4px 8px;");
expect(body).not.toContain("box-shadow: 0 16px 28px rgba(61, 125, 246, 0.18);");
```

- [ ] **Step 2: Run the focused shell test to verify it fails**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: FAIL because the current list still uses margin-based card spacing and a raised active shadow.

### Task 2: Implement the flat list styling

**Files:**
- Modify: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`

- [ ] **Step 1: Remove card spacing and reduce row rounding**

Update `.thread` CSS in `src/lib/ui.ts` to use:

```css
.thread {
  margin: 0;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 0;
  background: rgba(255, 255, 255, 0.72);
}
```

- [ ] **Step 2: Restore flat row separation and soften hover**

Update the adjacent-row and hover rules to use:

```css
.thread + .thread {
  border-top: 1px solid rgba(227, 231, 238, 0.7);
}

.thread:hover {
  background: rgba(246, 248, 252, 0.96);
  border-color: transparent;
}
```

- [ ] **Step 3: Keep blue selection but remove floating elevation**

Update `.thread.active` to remove the heavy shadow:

```css
.thread.active {
  box-shadow: none;
}
```

- [ ] **Step 4: Run the focused shell test to verify it passes**

Run:

```bash
npm test -- src/tests/app.test.ts
```

Expected: PASS with the flatter list CSS present.

### Task 3: Verify and deploy

**Files:**
- Verify changed files only

- [ ] **Step 1: Run project verification**

Run:

```bash
npm test
npm run check
```

Expected: full test suite PASS and type check exits 0.

- [ ] **Step 2: Deploy to Cloudflare**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler deploy
```

Expected: deploy succeeds and prints a new version id.

- [ ] **Step 3: Verify the deployed version appears remotely**

Run:

```bash
export NODE_OPTIONS="--require=$(pwd)/work/dns-override.cjs"
npx wrangler versions list --name cloudflare-email-inbox
```

Expected: the new version id appears in the remote list.
