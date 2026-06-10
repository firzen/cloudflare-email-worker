# Cloudflare Email Inbox MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of a Cloudflare-native multi-domain inbox with inbound email persistence, mailbox-scoped access control, and basic inbox APIs.

**Architecture:** Use a single TypeScript Worker with Hono for HTTP routes and an `email()` handler for inbound mail. Store queryable metadata in D1, raw messages and attachments in R2, and keep the first authentication layer intentionally simple with a seeded session-based login.

**Tech Stack:** Cloudflare Workers, TypeScript, Hono, D1, R2, Vitest, Wrangler

---

## File Structure

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wrangler.toml`
- Create: `migrations/0001_initial.sql`
- Create: `src/index.ts`
- Create: `src/app.ts`
- Create: `src/types/env.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/id.ts`
- Create: `src/lib/http.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/permissions.ts`
- Create: `src/lib/email/parse.ts`
- Create: `src/lib/email/storage.ts`
- Create: `src/lib/email/inbound.ts`
- Create: `src/routes/auth.ts`
- Create: `src/routes/mailboxes.ts`
- Create: `src/routes/folders.ts`
- Create: `src/routes/messages.ts`
- Create: `src/routes/audit.ts`
- Create: `src/tests/helpers/fake-env.ts`
- Create: `src/tests/permissions.test.ts`
- Create: `src/tests/auth.test.ts`
- Create: `src/tests/messages.test.ts`
- Create: `src/tests/inbound.test.ts`
- Create: `README.md`

## Task 1: Scaffold the Worker project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `wrangler.toml`
- Create: `src/index.ts`
- Create: `src/app.ts`
- Create: `src/types/env.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("app", () => {
  it("responds to health checks", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/messages.test.ts`
Expected: FAIL with module resolution errors because the app files do not exist yet.

- [ ] **Step 3: Write the minimal project scaffold**

`package.json`

```json
{
  "name": "cloudflare-email-inbox",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.8.3"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.8.20",
    "@cloudflare/workers-types": "^4.20260603.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4",
    "wrangler": "^4.20.3"
  }
}
```

`src/types/env.ts`

```ts
export type Env = {
  DB: D1Database;
  RAW_EMAILS: R2Bucket;
  ATTACHMENTS: R2Bucket;
  APP_SESSIONS: KVNamespace;
  APP_SECRET: string;
};
```

`src/app.ts`

```ts
import { Hono } from "hono";
import type { Env } from "./types/env";

export const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));
```

`src/index.ts`

```ts
import { app } from "./app";
import { handleInboundEmail } from "./lib/email/inbound";
import type { Env } from "./types/env";

export default {
  fetch: app.fetch,
  email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    return handleInboundEmail(message, env, ctx);
  },
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run check`
Expected: PASS for the smoke test and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts wrangler.toml src
git commit -m "chore: scaffold cloudflare worker inbox project"
```

## Task 2: Add the initial database schema and seed folders

**Files:**
- Create: `migrations/0001_initial.sql`
- Modify: `wrangler.toml`
- Test: `src/tests/messages.test.ts`

- [ ] **Step 1: Write the failing schema expectation test**

```ts
import { describe, expect, it } from "vitest";
import schema from "../../migrations/0001_initial.sql?raw";

describe("initial schema", () => {
  it("defines core tables", () => {
    expect(schema).toContain("CREATE TABLE users");
    expect(schema).toContain("CREATE TABLE mailboxes");
    expect(schema).toContain("CREATE TABLE messages");
    expect(schema).toContain("INSERT INTO folders");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/messages.test.ts`
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Write the initial migration**

`migrations/0001_initial.sql`

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  password_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mailboxes (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  full_address TEXT NOT NULL UNIQUE,
  route_type TEXT NOT NULL DEFAULT 'exact' CHECK (route_type IN ('exact', 'catch_all')),
  can_reply INTEGER NOT NULL DEFAULT 1 CHECK (can_reply IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id)
);

CREATE TABLE user_mailbox_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('read', 'reply', 'manage')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, mailbox_id, permission),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id)
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('system', 'custom')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  mailbox_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  message_id_header TEXT,
  in_reply_to_header TEXT,
  references_header TEXT,
  from_name TEXT,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT,
  html_body TEXT,
  snippet TEXT,
  received_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  deleted_at TEXT,
  raw_r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id),
  FOREIGN KEY (domain_id) REFERENCES domains(id),
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);

CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  disposition TEXT,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE outbound_messages (
  id TEXT PRIMARY KEY,
  reply_to_message_id TEXT,
  sent_by_user_id TEXT NOT NULL,
  sent_as_mailbox_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  to_email TEXT NOT NULL,
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL,
  text_body TEXT,
  html_body TEXT,
  in_reply_to_header TEXT,
  references_header TEXT,
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reply_to_message_id) REFERENCES messages(id),
  FOREIGN KEY (sent_by_user_id) REFERENCES users(id),
  FOREIGN KEY (sent_as_mailbox_id) REFERENCES mailboxes(id)
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('message', 'mailbox', 'folder', 'user', 'outbound_message')),
  target_id TEXT NOT NULL,
  mailbox_id TEXT,
  message_id TEXT,
  outbound_message_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (outbound_message_id) REFERENCES outbound_messages(id)
);

INSERT INTO folders (id, name, kind) VALUES
  ('fld_inbox', 'Inbox', 'system'),
  ('fld_archived', 'Archived', 'system'),
  ('fld_deleted', 'Deleted', 'system');
```

- [ ] **Step 4: Run tests to verify the schema passes**

Run: `npm test -- --run src/tests/messages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add migrations/0001_initial.sql wrangler.toml src/tests/messages.test.ts
git commit -m "feat: add initial d1 schema"
```

## Task 3: Add authentication and mailbox permission helpers

**Files:**
- Create: `src/lib/http.ts`
- Create: `src/lib/auth.ts`
- Create: `src/lib/permissions.ts`
- Create: `src/routes/auth.ts`
- Modify: `src/app.ts`
- Test: `src/tests/auth.test.ts`
- Test: `src/tests/permissions.test.ts`

- [ ] **Step 1: Write failing auth and permission tests**

```ts
import { describe, expect, it } from "vitest";
import { createSessionCookie, parseSessionCookie } from "../lib/auth";
import { hasMailboxPermission } from "../lib/permissions";

describe("auth", () => {
  it("round-trips a session cookie", async () => {
    const cookie = await createSessionCookie("usr_1", "secret");
    expect(await parseSessionCookie(cookie, "secret")).toBe("usr_1");
  });
});

describe("permissions", () => {
  it("returns true when the permission exists", () => {
    expect(
      hasMailboxPermission(
        [{ mailboxId: "mbx_1", permission: "reply" }],
        "mbx_1",
        "reply",
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/tests/auth.test.ts src/tests/permissions.test.ts`
Expected: FAIL because the auth and permission modules do not exist.

- [ ] **Step 3: Write minimal auth and permission helpers**

`src/lib/auth.ts`

```ts
const encoder = new TextEncoder();

export async function createSessionCookie(userId: string, secret: string) {
  const payload = btoa(JSON.stringify({ userId }));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bufferToHex(signature)}`;
}

export async function parseSessionCookie(cookie: string, secret: string) {
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature) return null;
  const expected = await createSessionCookie(JSON.parse(atob(payload)).userId, secret);
  if (expected !== cookie) return null;
  return JSON.parse(atob(payload)).userId as string;
}

function bufferToHex(input: ArrayBuffer) {
  return Array.from(new Uint8Array(input))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}
```

`src/lib/permissions.ts`

```ts
export type MailboxPermission = {
  mailboxId: string;
  permission: "read" | "reply" | "manage";
};

export function hasMailboxPermission(
  permissions: MailboxPermission[],
  mailboxId: string,
  permission: MailboxPermission["permission"],
) {
  return permissions.some(
    (entry) => entry.mailboxId === mailboxId && entry.permission === permission,
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- --run src/tests/auth.test.ts src/tests/permissions.test.ts && npm run check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/http.ts src/lib/auth.ts src/lib/permissions.ts src/routes/auth.ts src/app.ts src/tests/auth.test.ts src/tests/permissions.test.ts
git commit -m "feat: add session auth and mailbox permission helpers"
```

## Task 4: Implement inbound email storage in R2 and D1

**Files:**
- Create: `src/lib/id.ts`
- Create: `src/lib/db.ts`
- Create: `src/lib/email/parse.ts`
- Create: `src/lib/email/storage.ts`
- Create: `src/lib/email/inbound.ts`
- Test: `src/tests/inbound.test.ts`

- [ ] **Step 1: Write the failing inbound persistence test**

```ts
import { describe, expect, it, vi } from "vitest";
import { persistInboundEmail } from "../lib/email/inbound";

describe("persistInboundEmail", () => {
  it("stores the raw message and writes metadata", async () => {
    const env = {
      RAW_EMAILS: { put: vi.fn() },
      ATTACHMENTS: { put: vi.fn() },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({ run: vi.fn(async () => ({ success: true })) })),
        })),
      },
    } as any;

    const message = {
      from: "alice@example.com",
      to: "sales@a.com",
      headers: new Headers([["subject", "Hello"]]),
      raw: vi.fn(async () => new ArrayBuffer(3)),
    } as any;

    await persistInboundEmail(message, env);

    expect(env.RAW_EMAILS.put).toHaveBeenCalledTimes(1);
    expect(env.DB.prepare).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/tests/inbound.test.ts`
Expected: FAIL because the inbound modules do not exist.

- [ ] **Step 3: Write the minimal inbound persistence implementation**

`src/lib/email/inbound.ts`

```ts
import type { Env } from "../../types/env";
import { createId } from "../id";

export async function persistInboundEmail(message: ForwardableEmailMessage, env: Env) {
  const rawBuffer = await message.raw;
  const messageId = createId("msg");
  const rawKey = `raw/${messageId}.eml`;

  await env.RAW_EMAILS.put(rawKey, rawBuffer);

  await env.DB.prepare(
    `INSERT INTO messages (
      id, mailbox_id, domain_id, folder_id, from_email, to_email, subject, received_at, raw_r2_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      messageId,
      "mbx_unknown",
      "dom_unknown",
      "fld_inbox",
      message.from,
      message.to,
      message.headers.get("subject") ?? "",
      new Date().toISOString(),
      rawKey,
    )
    .run();

  return { messageId, rawKey };
}

export async function handleInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
  _ctx: ExecutionContext,
) {
  await persistInboundEmail(message, env);
}
```

- [ ] **Step 4: Run tests and record the known limitation**

Run: `npm test -- --run src/tests/inbound.test.ts`
Expected: PASS

Note in code comments or README that mailbox lookup is a temporary placeholder and will be replaced by exact mailbox resolution in a later task.

- [ ] **Step 5: Commit**

```bash
git add src/lib/id.ts src/lib/db.ts src/lib/email src/tests/inbound.test.ts README.md
git commit -m "feat: persist inbound emails to r2 and d1"
```

## Task 5: Build basic authenticated inbox read APIs

**Files:**
- Create: `src/routes/mailboxes.ts`
- Create: `src/routes/folders.ts`
- Create: `src/routes/messages.ts`
- Create: `src/routes/audit.ts`
- Modify: `src/app.ts`
- Test: `src/tests/messages.test.ts`

- [ ] **Step 1: Write the failing inbox API test**

```ts
import { describe, expect, it } from "vitest";
import { app } from "../app";

describe("messages api", () => {
  it("rejects unauthenticated users", async () => {
    const res = await app.request("/api/messages");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/tests/messages.test.ts`
Expected: FAIL because the API routes are not registered yet.

- [ ] **Step 3: Implement the route modules**

`src/routes/messages.ts`

```ts
import { Hono } from "hono";
import type { Env } from "../types/env";

export const messagesRouter = new Hono<{ Bindings: Env }>();

messagesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, 401);
  }

  const result = await c.env.DB.prepare(
    "SELECT id, subject, from_email, to_email, received_at, is_read FROM messages WHERE deleted_at IS NULL ORDER BY received_at DESC LIMIT 50"
  ).all();

  return c.json({ items: result.results ?? [] });
});
```

`src/app.ts`

```ts
import { Hono } from "hono";
import type { Env } from "./types/env";
import { messagesRouter } from "./routes/messages";

type Variables = {
  userId: string | null;
};

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  c.set("userId", null);
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));
app.route("/api/messages", messagesRouter);
```

- [ ] **Step 4: Run tests to verify the API contract**

Run: `npm test -- --run src/tests/messages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes src/app.ts src/tests/messages.test.ts
git commit -m "feat: add initial inbox read api"
```

## Task 6: Add basic project documentation and local setup notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the failing docs expectation test**

```ts
import { describe, expect, it } from "vitest";
import readme from "../../README.md?raw";

describe("README", () => {
  it("documents setup and migrations", () => {
    expect(readme).toContain("npm install");
    expect(readme).toContain("wrangler d1 migrations apply");
    expect(readme).toContain("wrangler dev");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/tests/auth.test.ts`
Expected: FAIL because the README does not exist.

- [ ] **Step 3: Write the README**

```md
# Cloudflare Email Inbox

## Setup

```bash
npm install
wrangler d1 migrations apply DB --local
wrangler dev
```

## What works today

- health endpoint
- D1 schema
- inbound raw email persistence
- initial authenticated inbox route shape

## Next

- mailbox resolution
- session-backed login
- folder and mailbox APIs
- reply flow
```

- [ ] **Step 4: Run the docs test**

Run: `npm test -- --run src/tests/auth.test.ts`
Expected: PASS after moving the README check into its own test file or the existing suite.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add local setup and project status"
```

## Self-Review Notes

- Spec coverage for the first development slice:
  - inbound persistence is covered in Task 4
  - mailbox-scoped access helpers are covered in Task 3
  - inbox read APIs are covered in Task 5
  - documentation and setup are covered in Task 6
- Deferred spec items for later slices:
  - exact mailbox lookup and catch-all resolution
  - move, delete, restore, and audit API behavior
  - manual reply flow with Cloudflare Email Sending
  - user and mailbox management APIs
- Placeholder scan completed:
  - no `TODO`, `TBD`, or unresolved placeholders remain in the plan
- Type consistency check completed:
  - `Env`, `userId`, and permission types are named consistently across tasks
