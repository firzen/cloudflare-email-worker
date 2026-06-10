# Cloudflare Email Inbox MVP Design

## Overview

This project is a multi-domain unified inbox built entirely on Cloudflare services.
It receives inbound email through Cloudflare Email Routing and Email Workers, stores raw messages and attachments in R2, keeps queryable metadata in D1, and exposes a web inbox for authenticated users.

The primary use case is a unified enterprise inbox across multiple domains with per-mailbox access control, message review, manual replies, folder management, and audit logging.

## Goals

- Receive email for multiple domains and multiple addresses into one system
- Preserve the original inbound email and attachments
- Provide a unified inbox UI for authorized users
- Support replying from the original recipient address
- Support soft delete and folder movement
- Support multi-user access control at the mailbox level
- Record auditable user actions, especially replies

## Non-Goals

- IMAP or SMTP server compatibility
- Advanced ticket workflow or assignment queues
- Full-text search in MVP
- Drafts, forwarding, rules engine, spam filtering, or AI features
- Fine-grained per-message permissions

## Architecture

### Components

1. Cloudflare Email Routing
   Routes inbound email from multiple domains and addresses into one Email Worker.

2. Email Worker
   Handles the `email()` event, parses the inbound message, stores raw content and attachments in R2, and writes normalized metadata into D1.

3. API Worker
   Exposes authenticated REST endpoints for inbox views, message operations, replies, mailbox management, and audit queries.

4. D1
   Stores users, domains, mailboxes, permissions, folders, message metadata, outbound reply metadata, and audit logs.

5. R2
   Stores raw `.eml` files and extracted attachments.

6. Web UI
   Provides the unified inbox experience for users. Users only see mailboxes they are allowed to access.

7. Cloudflare Email Sending
   Sends manual replies from the original mailbox address.

## Data Flow

### Inbound email flow

1. An external sender sends email to an address such as `sales@a.com`.
2. Cloudflare Email Routing forwards the message to the Email Worker.
3. The Worker extracts envelope and header data, text and HTML bodies, and attachments.
4. The Worker writes the raw email to R2.
5. The Worker writes attachments to R2.
6. The Worker creates a message record in D1 and associates it with the destination mailbox and the default inbox folder.

### Inbox read flow

1. A user authenticates in the web UI.
2. The API resolves which mailboxes the user can access.
3. Message list and detail endpoints only return messages belonging to authorized mailboxes.

### Reply flow

1. A user opens a message and submits a reply.
2. The API checks that the user has `reply` permission for the mailbox.
3. The API sends the message through Cloudflare Email Sending using the original mailbox address.
4. The system stores the outbound reply metadata in D1.
5. The system writes an audit log with the acting user and message linkage.

### Delete and folder flow

1. A user moves a message or deletes it.
2. The API verifies `manage` permission for the mailbox.
3. The message folder or delete marker is updated in D1.
4. The action is recorded in `audit_logs`.

## Authorization Model

Permissions are mailbox-scoped rather than message-scoped.

- `read`: view messages for a mailbox
- `reply`: send replies from that mailbox
- `manage`: move or delete messages and manage mailbox settings

User roles:

- `admin`: can manage users, domains, mailboxes, and permissions
- `operator`: can only act within granted mailbox permissions

## Folder Model

MVP uses shared folders.

System folders:

- `Inbox`
- `Archived`
- `Deleted`

Custom folders may be added later as shared folders visible to all authorized users. Personal labels are out of scope for MVP.

## Data Storage Principles

- D1 stores only queryable metadata and rendered bodies needed by the UI
- R2 stores the immutable raw email and attachments
- Raw emails are never discarded in MVP
- Deletes are soft deletes

## Core Schema

### users

Stores application users and roles.

### domains

Stores domains enabled for inbound routing.

### mailboxes

Stores mailbox identities such as `sales@a.com` and `info@b.com`, including catch-all entries if enabled.

### user_mailbox_permissions

Stores mailbox-scoped permissions per user.

### folders

Stores system and shared custom folders.

### messages

Stores normalized message metadata, bodies, folder assignment, and R2 raw email location.

### message_attachments

Stores attachment metadata and the R2 object key.

### outbound_messages

Stores manual reply metadata, delivery status, and sender identity.

### audit_logs

Stores user actions and reply lineage for auditability.

## API Scope

The MVP API surface includes:

- authentication
- mailbox listing
- folder listing
- message list
- message detail
- mark read or unread
- move message
- delete and restore message
- attachment download
- reply to message
- audit log listing

## Error Handling

- Unauthorized requests return `401`
- Forbidden mailbox actions return `403`
- Missing records return `404`
- Invalid payloads return `422`
- Delivery or storage failures return `500`

Inbound processing failures should be logged with enough metadata to retry from the raw email object if partial processing succeeded.

## Testing Strategy

### Unit tests

- permission checks
- message-to-mailbox access filtering
- reply payload construction
- folder and delete state transitions

### Integration tests

- inbound email persistence to D1 and R2
- message list and detail API behavior
- reply action with audit log creation

### Manual verification

- receive a real routed email
- view it in the inbox UI
- reply from the original mailbox identity
- confirm audit log attribution

## Implementation Phases

### Phase 1

- Scaffold Worker project
- Add D1 schema and migration
- Add R2 bindings
- Implement inbound email persistence

### Phase 2

- Implement authentication and authorization
- Implement mailbox, folder, and message read APIs

### Phase 3

- Implement move, delete, restore, and audit logs
- Implement manual replies with Cloudflare Email Sending

### Phase 4

- Build the basic inbox UI

## Open Decisions Resolved For MVP

- Scenario: unified enterprise inbox
- Reply identity: always reply from the original recipient mailbox
- Folder model: shared folders only
- Deletion model: soft delete only
- Permission model: mailbox-scoped `read`, `reply`, `manage`

## Risks

- Reply support depends on correct Cloudflare Email Sending configuration for each domain
- Email parsing edge cases may require raw email reprocessing
- D1 is suitable for MVP, but a later move to Postgres may be preferable if query complexity grows
