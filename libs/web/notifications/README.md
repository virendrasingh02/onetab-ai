# @org/notifications

Notification centre (UI only, per Phase 2 scope).

## Design

Ships the surface and empty state so the header affordance is real; the feed arrives with the realtime service.

## Surface

- `<NotificationCenter>` — slide-over panel built on `Sheet`.

## Notes

Accepts a `notifications` array so it can be driven by real data without a rewrite.

## Commands

```sh
nx lint @org/notifications
nx typecheck @org/notifications
```
