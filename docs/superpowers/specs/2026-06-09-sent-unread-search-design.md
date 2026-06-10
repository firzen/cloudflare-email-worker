# Sent, Unread, and Search Design

## Summary

This spec adds three connected improvements to the inbox product:

- a `Sent` system folder for viewing all successfully sent outbound mail
- a `Mark as unread` action for inbound mail
- a real global search experience that filters across all mail visible to the current user, regardless of the currently selected folder

The design intentionally keeps inbound and outbound storage separate in the database, then unifies them at the UI layer to minimize migration risk and keep delivery fast.

## Goals

- Let users review mail already sent by the system in one place.
- Let operators toggle inbound messages back to unread.
- Make the existing search box actually work.
- Keep mailbox visibility constrained to the current user's permitted mailboxes.
- Preserve the current UI structure and extend it without a large rewrite.

## Non-Goals

- No database migration to merge inbound and outbound mail into one table.
- No full-text search index in D1 for this round.
- No compose, forward, draft, or outbound failure center in this round.
- No read-state tracking for outbound mail.

## Current State

- Inbound mail lives in `messages` and is shown in the UI.
- Outbound mail already exists in `outbound_messages` and attachments exist in `outbound_message_attachments`, but there is no inbox view for them.
- Read state only supports `Mark read` by setting `messages.is_read = 1`.
- The search field is only visual and does not filter anything.

## Approach Options

### Option 1: UI-level unification with separate APIs

- Keep `messages` and `outbound_messages` separate.
- Add dedicated sent list/detail APIs.
- Add a virtual `Sent` folder to the folder response.
- Unify inbound and outbound records in the client for list rendering and search.

Pros:
- Lowest-risk path.
- No schema change required.
- Fastest way to ship the requested behavior.

Cons:
- The client carries a little more mapping logic.

### Option 2: Unified server-side mail view

- Build a server-side view model that merges inbound and outbound records before returning them.

Pros:
- Cleaner long-term API shape.

Cons:
- More backend work and higher regression risk for this round.

### Option 3: Mirror outbound rows into the inbound message model

- Create synthetic `messages` rows for sent mail.

Pros:
- Simplest frontend shape.

Cons:
- Duplicated data and confusing ownership semantics.
- Poor long-term maintenance fit.

### Recommendation

Choose Option 1. It gives the product behavior the user wants without destabilizing the existing message pipeline.

## Design

### 1. Sent folder

`Sent` will be introduced as a virtual system folder with id `fld_sent`.

Behavior:

- It appears in the folder list with other system folders.
- It is not persisted in the `folders` table for this round.
- Selecting it shows all outbound messages with `status = 'sent'` that belong to mailboxes visible to the current user.
- Sorting is `sent_at DESC, id DESC`.

Permission model:

- A user may see sent mail only when `sent_as_mailbox_id` belongs to one of their permitted mailboxes in `user_mailbox_permissions`.
- This keeps sent visibility aligned with the existing mailbox access model.

### 2. Outbound message APIs

Add two outbound endpoints under the existing messages route family:

- `GET /api/messages/sent`
- `GET /api/messages/sent/:id`

List response:

- `id`
- `folder_id` fixed as `fld_sent`
- `from_email`
- `to_email`
- `subject`
- `snippet`
- `received_at` derived from `sent_at`
- `is_read` fixed as `1`
- `message_type` fixed as `outbound`

Detail response:

- `id`
- `folderId` as `fld_sent`
- `messageType` as `outbound`
- `fromEmail`
- `toEmail`
- `subject`
- `textBody`
- `htmlBody`
- `receivedAt` derived from `sent_at`
- `isRead` fixed as `true`
- `attachments`

Attachments:

- Read from `outbound_message_attachments`
- Include filename, content type, and size
- Content download is not part of this round

### 3. Mark as unread

Add `POST /api/messages/:id/unread`.

Behavior:

- Uses the same visibility check as `Mark read`
- Sets `messages.is_read = 0`
- Returns `{ ok: true }`

UI behavior:

- The existing toolbar action remains in the same place.
- If the selected inbound message is unread, the button label is `Mark read`.
- If it is read, the label becomes `Mark unread`.
- The action is hidden or disabled for sent messages because outbound mail is not part of the inbound read-state model.

### 4. Global search

Search will run in the client against all mail already loaded for the current user.

Scope:

- inbound messages visible to the current user
- outbound sent messages visible to the current user
- independent of the currently selected folder

Matching fields:

- `from_email`
- `to_email`
- `subject`
- `snippet`
- inbound `text_body`
- outbound `text_body`
- outbound `html_body`

UI behavior:

- Typing a search term switches the list into a global result mode.
- Folder selection remains visible but does not constrain search results while a query is active.
- The list caption changes to reflect search result count.
- Clearing the search restores normal folder-based browsing.

### 5. Client data model updates

The client will keep inbound and outbound arrays separately, then combine them through a shared derived list.

State additions:

- `outboundMessages`
- `searchQuery`
- `selectedMessageType`

Message identity:

- Inbound and outbound ids are stored separately, so the client must track message type explicitly instead of assuming every selected id belongs to the inbound table.

Rendering rules:

- Inbound and outbound rows share the same list visual style.
- Sent rows should not show the unread badge.
- Detail actions depend on message type:
  - inbound: read/unread, move, delete, reply
  - outbound: none of those actions, read-only detail view

### 6. Folder ordering

`Inbox` remains the default selected folder.

For sidebar ordering:

- `Inbox` stays first
- `Sent` appears with other system folders near the top
- `All` remains the special catch-all row at the bottom

## Error Handling

- If sent detail is requested for a message the user cannot access, return `MESSAGE_NOT_FOUND`.
- If marking unread targets an inaccessible message, return `MESSAGE_NOT_FOUND`.
- If sent attachments are missing, the detail view still renders without failing the entire page.
- Search never throws; it only filters local state.

## Testing Strategy

### Automated

- Add route tests for:
  - sent list access
  - sent detail access
  - unread toggle access and success
- Extend fake DB support for outbound list/detail and unread mutation
- Update app shell tests for search and sent UI hooks if stable strings are added

### Manual

- Verify `Sent` appears in the sidebar
- Verify sent rows render and open detail correctly
- Verify inbound messages can toggle read and unread both ways
- Verify sent detail does not show reply/move/delete/read controls
- Verify search returns matches from both inbound and sent mail
- Verify clearing search restores folder browsing

## Acceptance Criteria

- Users can open `Sent` and view all visible successfully sent mail.
- Users can mark an inbound message as unread after it has been read.
- Search filters across all visible inbound and sent mail regardless of the selected folder.
- Inbox remains the default folder on load.
- Existing inbound reply, move, delete, and read flows do not regress.

## Implementation Notes

- Primary backend file: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/messages.ts`
- Folder response update: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/routes/folders.ts`
- Primary frontend file: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Supporting test files:
  - `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/messages.test.ts`
  - `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/folders.test.ts`
  - `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/helpers/fake-db.ts`
