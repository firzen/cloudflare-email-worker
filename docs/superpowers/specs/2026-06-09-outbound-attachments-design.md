# Outbound Attachments Design

## Overview

This design adds reusable outbound attachment support to the Cloudflare Email Inbox project.
The first user-facing entry point will be reply, but the underlying storage and payload-building flow will be shared with future compose and forward features.

The implementation will stay Cloudflare-native.
Attachments will be uploaded through the Worker, stored in `ATTACHMENTS` R2, recorded in D1, and sent through Cloudflare Email Sending without any third-party provider.

## Goals

- Allow users to upload attachments while replying to a message
- Preserve outbound attachments in the system for future auditing and sent-mail views
- Reuse the same attachment pipeline for future compose and forward actions
- Keep the current reply permission model intact
- Avoid mixing inbound attachment records with outbound attachment records

## Non-Goals

- Full compose or forward UI in this iteration
- Attachment preview rendering in the inbox UI
- Draft autosave for partially uploaded attachments
- Virus scanning, file-type allowlists, or content moderation
- Client-side hard limits on file count or file size beyond what browsers and Cloudflare already enforce

## Recommended Approach

### Option 1: Reusable outbound attachment pipeline

Add a dedicated outbound attachment model, switch the reply endpoint to `multipart/form-data`, store uploaded files in R2 before sending, and use a shared payload builder for reply and future send actions.

This is the recommended option because it solves the immediate reply need without hard-coding reply-specific storage rules.

### Option 2: Reply-only attachment support

Add attachments directly inside the current reply handler without new shared abstractions.

This is faster at first, but it would create cleanup work when compose and forward are added.

### Option 3: Raw MIME generation

Build outbound MIME messages manually and send raw messages instead of using structured `EMAIL.send()` payloads.

This gives maximum flexibility but adds complexity that is unnecessary for the current requirements.

## Chosen Design

Use Option 1.

Reply will be the first caller of a new outbound send pipeline made of three pieces:

1. Request parsing for multipart form fields and file uploads
2. Outbound attachment persistence into R2 and D1
3. Shared Cloudflare Email Sending payload construction

The next compose and forward endpoints will reuse the same attachment persistence and payload builder without schema changes.

## Architecture Changes

### Reply request format

The reply endpoint will move toward `multipart/form-data` as the primary request format.
During the transition, it should accept both the current JSON payload and the new `multipart/form-data` payload so existing callers do not break while the UI is updated.

Supported fields:

- `subject`: optional string; if missing or blank, use the existing default reply subject rule
- `textBody`: optional string
- `htmlBody`: optional string
- `attachments`: zero or more uploaded files

Validation rules:

- At least one of `textBody`, `htmlBody`, or `attachments` must be present
- Empty files are rejected
- Files missing a filename are rejected
- The server does not impose a product-specific attachment count or byte limit in this iteration
- Failures from Cloudflare Email Sending or Worker runtime limits are surfaced as structured API errors

### Shared outbound model

Introduce a dedicated outbound attachment record set that belongs to `outbound_messages`.

This keeps inbound and outbound files separate:

- `message_attachments` remains the inbound attachment table
- `outbound_message_attachments` becomes the outbound attachment table

This separation avoids overloading one table with two unrelated lifecycles and makes sent-mail auditing clearer.

### R2 storage layout

Outbound attachments will be stored in the existing `ATTACHMENTS` bucket with a separate key prefix from inbound attachments.

Recommended key pattern:

- `outbound/<outboundMessageId>/<attachmentId>/<filename>`

The exact filename component will be sanitized for safe storage, but the original filename will still be stored in D1 for display.

### Shared send payload builder

Add a helper that receives:

- mailbox sender identity
- recipient addresses
- final subject
- text and HTML bodies
- reply headers when applicable
- persisted outbound attachment descriptors

The helper will return the `EMAIL.send()` payload, including:

- `from`
- `to`
- `subject`
- `text`
- `html`
- `headers`
- `attachments`

This helper will be intentionally reply-agnostic so future compose and forward actions can call it directly.

## Data Model Changes

### New table: outbound_message_attachments

Add a new D1 table:

- `id`
- `outbound_message_id`
- `filename`
- `content_type`
- `size_bytes`
- `content_id`
- `disposition`
- `r2_key`
- `created_at`

Foreign key:

- `outbound_message_id` references `outbound_messages(id)` with cascade delete

Index:

- `idx_outbound_message_attachments_outbound_message_id`

### outbound_messages usage

The existing `outbound_messages` table remains the parent record for all manual send actions.

Reply will continue writing:

- sender user id
- source mailbox id
- target recipient
- subject
- body content
- threading headers
- provider message id
- sent status

No schema change is required there for attachment support because attachments are stored in the new child table.

## Request and Processing Flow

### Reply with attachments

1. User opens a message and selects one or more files.
2. Browser submits `multipart/form-data` to `POST /api/messages/:id/reply`.
3. API verifies the acting user has `reply` or `manage` permission for the mailbox.
4. API parses form fields and uploaded files.
5. API validates that the request is not empty and that each file has basic metadata.
6. API creates the `outbound_messages` parent id early and inserts a `pending` parent row so attachment keys and later failure states can reference a durable record.
7. API stores each attachment in `ATTACHMENTS` R2 and inserts one `outbound_message_attachments` row per file.
8. API loads the persisted files back into the Cloudflare send payload shape.
9. API calls `env.EMAIL.send()` with the reply headers and attachments.
10. API updates the outbound message record to `sent` on success or `failed` with an error message on provider failure.
11. API writes an audit log including the attachment summary and acting user id.

### Failure handling

- If request validation fails, return `400`
- If attachment storage fails before send, return `500` and do not call the email provider
- If email sending fails after attachment persistence, return `502`, mark the outbound message as `failed`, and keep attachment records for audit and retry visibility
- If audit logging fails after send, return `500` only if the database write truly failed before the response; otherwise preserve the sent result and log operationally

## UI Changes

### Reply panel

The reply box will gain:

- a subject input, prefilled with the default reply subject
- a file input allowing multiple file selection
- a lightweight selected-file list showing filename and size before send

The send action will switch from JSON submission to `FormData`.

### Scope of visible UI

This iteration will not add:

- drag-and-drop upload
- attachment removal after upload to server
- sent attachment history panel in the main UI

The UI change stays intentionally small so the reusable backend model can land safely first.

## API and Helper Boundaries

### Route layer

`src/routes/messages.ts` should remain responsible for:

- permission checks
- locating the source message
- parsing the incoming form
- coordinating persistence, send, and audit steps
- mapping failures to API responses

### New helper layer

Add focused helpers for:

- parsing outbound form attachments
- storing outbound attachment objects and records
- building the Cloudflare send payload attachments array

This keeps future compose and forward endpoints from duplicating reply-specific parsing logic.

## Audit Model

Reply audit metadata should be expanded to include:

- `outboundMessageId`
- `providerMessageId`
- `fromEmail`
- `toEmail`
- `sentAsMailboxId`
- `attachmentCount`
- `attachments`: array of filename, contentType, and size

This preserves attribution for multi-user operations and makes it clear which user sent which files.

## Error Handling Details

Structured error responses should add or reuse codes such as:

- `INVALID_REPLY_BODY`
- `INVALID_ATTACHMENT`
- `ATTACHMENT_STORAGE_FAILED`
- `EMAIL_SEND_FAILED`

`INVALID_REPLY_BODY` should now mean the reply contains no body content and no attachments.

## Testing Strategy

### Unit and route tests

- reply still rejects unauthenticated users
- reply still returns `404` for inaccessible messages
- reply accepts `multipart/form-data` with body-only payloads
- reply accepts attachments even when body fields are empty
- reply rejects empty submissions with no body and no attachments
- reply stores outbound attachment rows and R2 objects
- reply sends attachments through `EMAIL.send()`
- reply marks outbound message as `failed` when provider send fails after attachment persistence
- reply audit metadata includes attachment summary

### Schema tests

- migration includes `outbound_message_attachments`
- migration includes the new index

### Manual verification

- upload a small text attachment in a reply
- upload a binary file such as PDF or PNG in deployed environment
- confirm recipient receives the attachment
- confirm D1 and R2 contain outbound attachment metadata and objects

## Risks and Mitigations

### Runtime and provider limits

Cloudflare may reject oversized messages or attachments.
This iteration does not add product-specific caps, so the API must surface provider errors clearly and avoid claiming success when the provider rejects the send.

### Partial persistence

Attachments may already be in R2 when email sending fails.
That is acceptable because the records are useful for auditability and future resend tooling.

### Compatibility with current tests

The existing reply tests currently send JSON.
They will need to move to `FormData`-based request coverage or the route must temporarily support both request formats during transition.

## Implementation Notes

- Prefer a short transition period where the route accepts both JSON and `multipart/form-data` if it reduces UI rollout risk
- Keep attachment persistence logic independent of reply header generation
- Do not mutate or reuse inbound attachment tables for outbound files
- Reuse the existing `ATTACHMENTS` bucket instead of provisioning a new bucket
