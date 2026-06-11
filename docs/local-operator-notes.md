# Local Operator Notes

Last verified: 2026-06-11

## Wrangler Login

On this machine, `npx wrangler whoami` succeeded and showed an active OAuth login.

- Account email: `yxqzrnutsyzjvr@outlook.com`
- Account ID: `f7f2db0274699dfc52b10c317c466b31`

The available token scopes at verification time included the permissions needed for this project's normal operations, including:

- `workers_scripts (write)`
- `d1 (write)`
- `workers_tail (read)`
- `email_routing (write)`
- `email_sending (write)`

If a future session needs to re-check this, run:

```bash
npx wrangler whoami
```

## Deployment Status

The Worker was successfully deployed from this machine on 2026-06-11.

- Worker name: `cloudflare-email-inbox`
- Worker URL: `https://cloudflare-email-inbox.yxqzrnutsyzjvr.workers.dev/`
- Verified health endpoint: `GET /health`

The deployment during this verification produced:

- Version ID: `78ec27f2-6d49-4aa7-b3fe-d34f71f948b4`

## DingTalk Alerting

This repository is wired to send exception alerts to DingTalk through Worker secrets:

- `DINGTALK_WEBHOOK`
- `DINGTALK_SECRET`

These secrets were uploaded successfully to the Worker on 2026-06-11.

An admin-only self-test endpoint is available:

- `POST /api/users/alert-test`

Expected behavior:

- Unauthenticated requests return `401`
- Authenticated admin requests return `200` with:

```json
{"ok":true,"message":"Alert test queued."}
```

## Notes

This file records machine-local operational state that may change over time. Before relying on it for production actions, re-verify the live state with the relevant command.
