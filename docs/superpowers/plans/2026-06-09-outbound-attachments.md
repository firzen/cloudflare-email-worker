# Outbound Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add attachment uploads to reply, persist outbound attachments in R2 and D1, and structure the send path so future compose and forward flows can reuse it.

**Architecture:** Keep the existing reply route as the first entry point, but extract outbound attachment parsing, storage, and send-payload construction into focused helpers. Persist a `pending` outbound message first, store attachments under an `outbound/` prefix in the existing `ATTACHMENTS` bucket, then send through `env.EMAIL.send()` and finalize the outbound status.

**Tech Stack:** Cloudflare Workers, Hono, D1, R2, TypeScript, Vitest

---

### Task 1: Add schema coverage for outbound attachments

**Files:**
- Modify: `migrations/0001_initial.sql`
- Modify: `src/tests/schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

```ts
it("includes outbound attachment storage", () => {
  const sql = readFileSync("migrations/0001_initial.sql", "utf8");

  expect(sql).toContain("CREATE TABLE outbound_message_attachments (");
  expect(sql).toContain(
    "CREATE INDEX idx_outbound_message_attachments_outbound_message_id ON outbound_message_attachments(outbound_message_id);",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/schema.test.ts`
Expected: FAIL because the migration does not yet define `outbound_message_attachments`

- [ ] **Step 3: Write minimal migration changes**

```sql
CREATE TABLE outbound_message_attachments (
  id TEXT PRIMARY KEY,
  outbound_message_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  content_id TEXT,
  disposition TEXT,
  r2_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (outbound_message_id) REFERENCES outbound_messages(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_outbound_message_attachments_outbound_message_id ON outbound_message_attachments(outbound_message_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/tests/schema.test.ts`
Expected: PASS

### Task 2: Add failing reply route tests for multipart and attachments

**Files:**
- Modify: `src/tests/messages.test.ts`

- [ ] **Step 1: Write the failing test for attachment-only reply**

```ts
it("accepts attachment-only replies and persists outbound attachments", async () => {
  const sourceMessage = {
    id: "msg_1",
    mailbox_id: "mbx_support",
    from_email: "alice@example.com",
    to_email: "support@example.net",
    subject: "Need help",
    message_id_header: "<msg-1@example.com>",
    references_header: null,
  };
  const send = vi.fn(async () => ({ messageId: "cf-message-1" }));
  const run = vi.fn(async () => ({ success: true }));
  const put = vi.fn(async () => ({}));
  const bindFirst = vi.fn(() => ({ first: vi.fn(async () => sourceMessage) }));
  const bindRun = vi.fn(() => ({ run }));
  const prepare = vi
    .fn()
    .mockImplementationOnce(() => ({ bind: bindFirst }))
    .mockImplementation(() => ({ bind: bindRun }));
  const cookie = await createSessionCookie("usr_replier", "secret");
  const form = new FormData();
  form.set("subject", "Custom subject");
  form.set("attachments", new File(["hello"], "note.txt", { type: "text/plain" }));

  const res = await app.request(
    "/api/messages/msg_1/reply",
    {
      method: "POST",
      body: form,
      headers: { cookie: `session=${cookie}` },
    },
    {
      APP_SECRET: "secret",
      DB: { prepare },
      EMAIL: { send },
      ATTACHMENTS: { put },
    },
  );

  expect(res.status).toBe(200);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      subject: "Custom subject",
      attachments: [
        expect.objectContaining({
          filename: "note.txt",
          contentType: "text/plain",
        }),
      ],
    }),
  );
  expect(put).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Write the failing test for empty multipart reply**

```ts
it("rejects multipart replies with no body and no attachments", async () => {
  const sourceMessage = {
    id: "msg_1",
    mailbox_id: "mbx_support",
    from_email: "alice@example.com",
    to_email: "support@example.net",
    subject: "Need help",
    message_id_header: "<msg-1@example.com>",
    references_header: null,
  };
  const prepare = vi.fn().mockImplementationOnce(() => ({
    bind: vi.fn(() => ({ first: vi.fn(async () => sourceMessage) })),
  }));
  const cookie = await createSessionCookie("usr_replier", "secret");
  const form = new FormData();

  const res = await app.request(
    "/api/messages/msg_1/reply",
    {
      method: "POST",
      body: form,
      headers: { cookie: `session=${cookie}` },
    },
    { APP_SECRET: "secret", DB: { prepare } },
  );

  expect(res.status).toBe(400);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/tests/messages.test.ts`
Expected: FAIL because the reply route only accepts JSON and has no attachment support

### Task 3: Implement reusable outbound attachment helpers

**Files:**
- Create: `src/lib/email/outbound.ts`
- Modify: `src/types/env.ts`
- Test: `src/tests/messages.test.ts`

- [ ] **Step 1: Write minimal helper signatures guided by the failing tests**

```ts
export type PersistedOutboundAttachment = {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  r2Key: string;
  content: ArrayBuffer;
};

export async function persistOutboundAttachments(...) { ... }
export async function buildOutboundEmailAttachments(...) { ... }
```

- [ ] **Step 2: Implement minimal helper logic**

```ts
const r2Key = `outbound/${outboundMessageId}/${attachmentId}/${safeFilename}`;
await bucket.put(r2Key, bytes, {
  httpMetadata: contentType ? { contentType } : undefined,
});
await runStatement(db, insertSql, ...values);
```

- [ ] **Step 3: Extend email sender payload typing**

```ts
export type OutboundEmailAttachment = {
  filename: string;
  contentType?: string;
  data: ArrayBuffer;
};
```

- [ ] **Step 4: Run message tests to keep the helper contract green**

Run: `npm test -- src/tests/messages.test.ts`
Expected: still FAIL, but now because the route has not been wired to the new helpers yet

### Task 4: Update reply route for JSON plus multipart support

**Files:**
- Modify: `src/routes/messages.ts`
- Modify: `src/tests/messages.test.ts`
- Test: `src/tests/messages.test.ts`

- [ ] **Step 1: Add a failing test for provider failure after attachment persistence**

```ts
it("marks outbound message as failed when send fails after attachments were stored", async () => {
  // create multipart reply with one file
  // expect ATTACHMENTS.put called
  // expect outbound_messages insert and failed-status update statements executed
  // expect 502 EMAIL_SEND_FAILED response
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/tests/messages.test.ts`
Expected: FAIL because the route does not persist pending outbound messages or failed status updates

- [ ] **Step 3: Implement minimal route changes**

```ts
const parsed = await parseReplyRequest(c.req);
const finalSubject = parsed.subject || buildReplySubject(message.subject);
const outboundMessageId = createId("out");

await runStatement(db, insertPendingOutboundSql, ...);
const attachments = await persistOutboundAttachments(...);

try {
  providerResult = await c.env.EMAIL.send({
    from: message.to_email,
    to: message.from_email,
    subject: finalSubject,
    text: parsed.textBody || undefined,
    html: parsed.htmlBody || undefined,
    headers: buildReplyHeaders(message),
    attachments: await buildOutboundEmailAttachments(c.env.ATTACHMENTS, attachments),
  });
  await runStatement(db, updateSentOutboundSql, ...);
} catch (error) {
  await runStatement(db, updateFailedOutboundSql, ...);
  return c.json(emailSendFailedResponse(details), 502);
}
```

- [ ] **Step 4: Run tests to verify the route passes**

Run: `npm test -- src/tests/messages.test.ts`
Expected: PASS

### Task 5: Update the reply UI to submit subject and attachments

**Files:**
- Modify: `src/lib/ui.ts`
- Test: `src/tests/app.test.ts`

- [ ] **Step 1: Write the failing UI test**

```ts
expect(html).toContain('id="reply-subject"');
expect(html).toContain('id="reply-attachments"');
expect(html).toContain("new FormData()");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/tests/app.test.ts`
Expected: FAIL because the current reply box only renders a textarea and posts JSON

- [ ] **Step 3: Implement the minimal UI changes**

```ts
'<label for="reply-subject">Subject</label>' +
'<input id="reply-subject" value="' + escapeHtml(defaultReplySubject(item.subject)) + '" />' +
'<label for="reply-attachments">Attachments</label>' +
'<input id="reply-attachments" type="file" multiple />'
```

```ts
const form = new FormData();
form.set("subject", document.getElementById("reply-subject").value);
form.set("textBody", document.getElementById("reply-text").value);
for (const file of document.getElementById("reply-attachments").files) {
  form.append("attachments", file);
}
```

- [ ] **Step 4: Run the UI test to verify it passes**

Run: `npm test -- src/tests/app.test.ts`
Expected: PASS

### Task 6: Verify docs and full project health

**Files:**
- Modify: `README.md`
- Test: `src/tests/messages.test.ts`, `src/tests/app.test.ts`, `src/tests/schema.test.ts`

- [ ] **Step 1: Write the minimal doc update**

```md
- Reply supports editable subject and file attachments
- Outbound attachments are persisted in R2 and D1 for auditability
```

- [ ] **Step 2: Run targeted tests**

Run: `npm test -- src/tests/schema.test.ts src/tests/messages.test.ts src/tests/app.test.ts`
Expected: PASS

- [ ] **Step 3: Run full verification**

Run: `npm test && npm run check`
Expected: PASS
