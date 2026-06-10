# UI Feedback Refresh Design

## Summary

This spec improves the inbox UI so it feels steadier in overall tone while making key interactions more obvious. The work focuses on button feedback, smoother message switching, clearer success and error notifications, and small layout refinements that strengthen hierarchy without changing the app's basic three-column structure.

## Goals

- Make every important action feel responsive and intentional.
- Reduce the visual "stutter" when switching between messages.
- Make reply and other action results obvious without forcing users to scan the page.
- Improve information hierarchy so folders, list items, and message detail each feel clearly scoped.
- Reuse the same interaction patterns for reply, move, delete, permission save, login, refresh, and Cloudflare sync.

## Non-Goals

- No framework migration or component library introduction.
- No backend API changes unless a small response field is required for UI consistency.
- No new major product features such as compose, forward, or bulk actions.
- No redesign of mailbox permissions, audit, or sync workflows beyond visual feedback improvements.

## Current Problems

### Action feedback is weak

Buttons mostly change color but do not communicate press, progress, disabled state, or completion clearly. This makes actions feel uncertain, especially reply and admin actions.

### Message switching feels abrupt

The message list selection updates immediately, but the detail pane swaps content by replacing HTML with no transition or loading state. The result feels jumpy during navigation.

### Result visibility is too subtle

Reply success and failure states appear only in a small inline status line. Users can miss the outcome, especially after looking away from the reply area.

### Layout hierarchy is too flat

The three columns are usable, but the visual hierarchy does not clearly communicate navigation versus list versus active content. The result is a slightly cramped, low-feedback feel.

## Approach Options

### Option 1: Minimal feedback patch

Only add hover, pressed, loading, and toast feedback without changing layout.

Pros:
- Fastest and lowest risk.

Cons:
- Solves uncertainty, but not the flat hierarchy or message-switching feel.

### Option 2: Feedback system plus layout polish

Add unified control states, detail-pane transitions, global toast notifications, and modest layout refinements while preserving the current structure.

Pros:
- Best balance of impact and implementation cost.
- Directly addresses all reported pain points.

Cons:
- Requires touching CSS, render logic, and action handling together.

### Option 3: Interaction architecture refactor

Introduce a more formal client-side state and rendering system before improving the UI.

Pros:
- Best long-term foundation.

Cons:
- Too large for the current need and would slow delivery.

### Recommendation

Choose Option 2. It gives a visible quality jump while keeping the current app architecture intact.

## Design

### 1. Unified control feedback

All action buttons will support four states:

- `default`
- `hover`
- `pressed`
- `loading`

Shared behavior:

- Hover slightly raises contrast and edge definition.
- Pressed state applies a subtle downward movement and tighter shadow so the button feels physically engaged.
- Loading state disables repeat clicks, reduces motion, and swaps the label to a progress label where appropriate.
- Disabled state lowers contrast and removes press affordance.

Applied to:

- Login
- Refresh
- Settings modal actions
- Save permissions
- Run Cloudflare sync
- Mark read
- Move
- Delete
- Reply send

Danger actions:

- Delete remains a move-to-deleted action, but its styling will use a soft danger tone so it reads as destructive without overpowering the layout.

### 2. Smoother message switching

Message switching should feel immediate but not abrupt.

Behavior:

- Clicking a message row updates the active row immediately.
- The detail pane enters a short loading transition before the new message content appears.
- If the detail request is fast, the user still sees a subtle fade between states instead of a hard content swap.
- If the request is slower, the detail pane shows a lightweight skeleton/loading surface rather than a blank area.

Implementation shape:

- Add a small UI state flag for detail loading.
- Render a loading variant of the detail pane while fetching.
- Animate opacity and slight vertical translation for entering content.

### 3. Global toast notifications

Important outcomes should be visible regardless of scroll position inside the message pane.

Toast behavior:

- Success toasts: green-accented, auto-dismiss after a short delay.
- Error toasts: warm danger tone, remain longer so users can read the issue.
- Only one or a small stack of toasts is allowed at once to avoid clutter.
- Inline status remains for local context, but toast becomes the primary notification layer.

Used for:

- Reply success and failure
- Move success and failure
- Mark read success and failure
- Delete success and failure
- Permission save result
- Cloudflare sync result
- Login failure
- Refresh failure

### 4. Layout refinements

The structure remains sidebar, thread list, and detail pane, but the hierarchy becomes clearer.

Sidebar:

- Make folder navigation feel more like a stable navigation rail.
- Strengthen active folder contrast.
- Reduce visual weight of inactive folders.

Thread list:

- Increase row separation slightly.
- Make selected and unread states easier to distinguish at a glance.
- Improve spacing so sender, subject, and timestamp scan faster.

Detail pane:

- Strengthen the thread header hierarchy.
- Make the active message card and reply composer feel like two related but distinct blocks.
- Improve breathing room in the content area so the reply section does not feel jammed against the message body.

Reply attachments:

- Replace the plain text attachment summary with a clearer file list treatment that can be reused later for compose and forward.

### 5. Input and field polish

The current search input uses a real value instead of placeholder behavior. It should be corrected so it behaves like a normal search field.

Field improvements:

- Use actual placeholder text for search.
- Improve focus rings for input, textarea, and select controls.
- Make attachment selection clearer through dedicated visual feedback.

### 6. Reusable action-state handling

The page currently has several actions that each manage status in a slightly ad hoc way. This refresh will introduce lightweight shared helpers for:

- setting loading state on a button
- restoring button state after completion
- showing toast feedback
- showing contextual inline status where needed

This is not a framework rewrite. It is a small shared interaction layer inside the existing inline script.

## Error Handling

- If an action fails, the inline status area still shows the detailed message.
- The toast shows a shorter readable summary when possible.
- Detail loading failure keeps the list selection intact and shows a recoverable error state in the detail pane instead of empty content.
- Buttons must always restore from loading state after both success and failure.

## Testing Strategy

### Automated

- Update server-rendered app tests to assert the new UI hooks and labels that are stable enough for tests.
- Add focused tests for any helper logic extracted into pure functions where practical.

### Manual

- Verify all major buttons show hover, pressed, and loading feedback.
- Verify reply success shows inline success plus toast.
- Verify reply failure shows inline failure plus toast.
- Verify moving, deleting, mark read, permission save, refresh, and sync all restore button states after completion.
- Verify switching messages feels smooth on both fast and slightly delayed responses.
- Verify Inbox remains the default folder and folder navigation still works.
- Verify mobile breakpoints still behave acceptably after spacing and feedback updates.

## Acceptance Criteria

- A user can tell when a button has been pressed, is busy, and has completed.
- Switching between messages no longer feels like a hard content snap.
- Reply results are easy to notice without scanning the bottom of the form.
- The detail pane shows a deliberate loading or transition state instead of flashing empty content.
- The search field behaves like a normal input with placeholder text.
- No existing workflow is removed or behaviorally regressed.

## Implementation Notes

- Primary implementation target is `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/lib/ui.ts`.
- Supporting tests will change in `/Users/bb/Documents/Codex/2026-06-06/cloudflare-email-worker/src/tests/app.test.ts`.
- Keep the visual language consistent with the current product and avoid turning the refresh into a full redesign.
