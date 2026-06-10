# Missive UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the inbox UI to match the approved Missive-inspired layout, move settings and admin management into a bottom-left modal, and simplify the left navigation to folders only.

**Architecture:** Keep the current single-file UI shell in `src/lib/ui.ts`, but replace its markup/CSS/client script with the approved layout. Preserve the existing REST APIs and message actions, and remap them into the new shell without backend route changes.

**Tech Stack:** TypeScript, Hono HTML response, browser-side vanilla JavaScript, Vitest.

---

### Task 1: Lock the new shell in tests

**Files:**
- Modify: `src/tests/app.test.ts`
- Modify: `src/lib/ui.ts`

- [ ] Add assertions for the new workspace shell IDs and for the settings modal replacing the old inline admin panel.
- [ ] Run `npm test -- src/tests/app.test.ts` and verify the new assertions fail before implementation.

### Task 2: Replace the page shell and navigation

**Files:**
- Modify: `src/lib/ui.ts`

- [ ] Replace the warm hero-style shell with the approved four-column Missive-style layout and keep the login gate.
- [ ] Simplify the left navigation to folders only, with the settings trigger anchored in the lower-left area.
- [ ] Keep message list and detail action hooks available through stable DOM IDs.

### Task 3: Move admin controls into settings modal

**Files:**
- Modify: `src/lib/ui.ts`

- [ ] Replace the inline admin panel with a modal containing workspace settings, mailbox permission assignment, and employee listing sections.
- [ ] Ensure the modal is hidden for non-admin users where appropriate while still exposing general settings and logout.
- [ ] Reuse existing `/api/users` and `/api/mailboxes/:id/permissions` calls.

### Task 4: Rebind message rendering and actions

**Files:**
- Modify: `src/lib/ui.ts`

- [ ] Update client-side rendering to populate folders, messages, detail view, reply, move, read, delete, and refresh inside the new layout.
- [ ] Keep the current action endpoints and status/error handling intact.

### Task 5: Verify

**Files:**
- Modify: `src/tests/app.test.ts`
- Modify: `src/lib/ui.ts`

- [ ] Run `npm test -- src/tests/app.test.ts` until green.
- [ ] Run `npm test` for the full suite.
- [ ] If the local app can be launched, visually verify the updated page in the browser.
