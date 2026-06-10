# Cloudflare Email Inbox

A Cloudflare-native multi-domain inbox MVP built with Workers, D1, R2, and Email Routing.

## What Works

- Inbound email persistence from Email Workers into `R2` and `D1`
- Exact-address and domain catch-all mailbox resolution for inbound mail
- Cookie-based login, logout, and current-session lookup
- Unified inbox web UI at `/`
- Read-only APIs for folders, mailboxes, messages, message detail, and audit logs
- Mailbox-scoped visibility using `user_mailbox_permissions`
- Message actions:
  - mark read
  - soft delete
  - move to folder
  - reply with editable subject and attachments
- Reply persistence into `outbound_messages`
- Outbound attachment persistence into `outbound_message_attachments` and `ATTACHMENTS` R2
- Reply audit entries in `audit_logs`

## Local Setup

```bash
npm install
npm test
npm run check
wrangler d1 migrations apply DB --local
wrangler dev
```

## Required Bindings

The Worker expects these bindings:

- `DB`: D1 database
- `RAW_EMAILS`: R2 bucket for raw `.eml` objects
- `ATTACHMENTS`: R2 bucket for attachments
- `APP_SESSIONS`: KV namespace placeholder for future session storage
- `APP_SECRET`: secret used to sign session cookies
- `EMAIL`: Cloudflare email sending binding used by the reply endpoint
- `CLOUDFLARE_ACCOUNT_ID`: account id used by the admin sync action
- `CLOUDFLARE_API_TOKEN`: API token with zone/email routing/email sending permissions for the admin sync action
- `CLOUDFLARE_WORKER_NAME`: worker script name that catch-all routing should bind to
- `BOOTSTRAP_ADMIN_USER_ID`: optional fallback admin user id that should always receive catch-all mailbox permissions

## Current Limits

- Mailbox visibility is enforced, and there is now a minimal admin permission panel, but there is no broader user-management workflow yet
- Admin settings now include a Cloudflare sync action that checks all active full zones, repairs Worker catch-all routing, ensures email sending exists, and syncs catch-all mailbox rows into D1
- `move` now checks that the folder exists, but folders are still global rather than per-user
- Reply uses the original recipient address, supports editable subjects and file attachments, and records outbound/audit metadata, but advanced retry handling is not implemented
- Domain onboarding is still an operational setup step: Cloudflare Email Routing catch-all rules and matching `domains` / `mailboxes` rows must exist for each domain
- The login flow expects `users.password_hash` to contain a SHA-256 hex digest of the plaintext password

## Key Routes

- `GET /`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/mailboxes`
- `GET /api/folders`
- `GET /api/messages`
- `GET /api/messages/:id`
- `POST /api/messages/:id/read`
- `POST /api/messages/:id/delete`
- `POST /api/messages/:id/move`
- `POST /api/messages/:id/reply`
- `GET /api/audit-logs`
- `GET /api/users`
- `GET /api/mailboxes/:id/permissions`
- `PUT /api/mailboxes/:id/permissions`
