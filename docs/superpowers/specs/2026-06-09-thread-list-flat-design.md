# Thread List Flat Design

## Summary

This spec changes only the middle message list column back to a flatter list treatment. The selected row remains blue, but the list items should no longer feel like floating cards. Rows should read as full-width list entries with light background layering.

## Goals

- Remove card-like spacing, corner radius emphasis, and elevated hover feel from the middle list.
- Keep the current blue selected state.
- Preserve readability through subtle row background layering instead of heavy dividers.
- Avoid changing the left folder rail or right detail pane.

## Non-Goals

- No structural changes to list rendering.
- No behavior changes to selection, search, unread badges, or sent rows.
- No redesign of sidebars, detail cards, or toolbars.

## Design

### Row layout

- Rows span the usable width of the list container.
- Remove the current outer margins that create a detached card look.
- Reduce corner radius so rows feel integrated with the list, not isolated blocks.

### Visual separation

- Use a very light row background for default items.
- Use a slightly darker but still subtle background on hover.
- Restore a soft top divider between adjacent rows so the list reads as one surface.

### Selected state

- Keep the blue selected state.
- Reduce the “floating” feel by removing the large selection shadow.
- Keep text contrast and unread signaling unchanged.

## Acceptance Criteria

- Middle list rows no longer look like separate cards.
- The selected row is still clearly blue and active.
- The list retains light layered separation between rows.
- No change in behavior outside the middle list styling.

## Implementation Notes

- Primary file: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`
- Supporting test: `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`
