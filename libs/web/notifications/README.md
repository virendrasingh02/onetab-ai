# @org/notifications

Activity feed data plus the small chrome that advertises it.

## Design

The feed itself is rendered in one place only — the Inbox page's _Activity_ tab
(`@org/web-work-tools`). A slide-over `<NotificationCenter>` used to render the
same rows from the header bell, which meant two surfaces, two empty states and
two competing "mark as seen" rules over one query. The bell is now a link to the
Inbox and this library keeps the hooks plus the badge.

## Surface

- `<NotificationBadge>` — the count that overlays the header bell.
- `<NotificationEnableBar>` — the browser-permission prompt.
- `useNotificationFeed` / `useNotificationUnread` — feed and derived read state.

## Notes

Read state is client-side and per workspace; see `use-notifications.ts` for why
the server has no per-user receipts.

## Commands

```sh
nx lint @org/notifications
nx typecheck @org/notifications
```
