# Unified System/Activity Events — status & follow-ups

Implements the "Unified System Events, Join/Leave & Activity Messages" brief.
This file records what shipped, the architecture decision behind it, and what
is explicitly deferred. All work below is uncommitted.

## Architecture decision: events are Matrix messages, not a new table

The brief's `SystemEvent { id, workspaceId, conversationId, eventType, actor,
target, metadata, ... }` shape is real (`libs/shared/types/src/lib/system-event.ts`,
`SystemActivityEventContent`), but it is **not** backed by a new Postgres
table. This platform's entire conversation timeline — channels, DMs, group
DMs — already lives in Matrix, with its own persistence, ordering
(`origin_server_ts`), pagination (`/messages`), realtime sync (`/sync`), and
reactions (`m.reaction`). Every other rich message type (`mie.ai.agent`,
`mie.app.response`, `mie.approval`, …) already rides that same pipe via
`MatrixBotMessagingService.sendStructured` / `MatrixClient.sendStructuredMessage`.
A system/activity event is one more `StructuredChatMessage` variant
(`mie.system_event`) posted the same way, by a dedicated `system-events` bot
identity (`SystemEventPublisherService`, `@org/api-matrix`) that is lazily
provisioned and joined to a room exactly like an agent or app bot already is.

This gets persistence, ordering, pagination, realtime delivery and reactions
for free, with no new infrastructure — see brief §15–17, §32. The cost is that
these events don't have their own queryable Postgres rows; see "Search" below
for what that means in practice.

## What's implemented and tested

- **Types**: `SystemActivityEventContent`, `SystemEventEntity`,
  `SystemEventType`, `SystemEventConversationType`, `getSystemEventCapabilities`,
  `formatSystemEventFallbackText` (`libs/shared/types/src/lib/system-event.ts`).
  Wired into `StructuredChatMessage` and `validateStructuredEvent`.
- **Backend**: `SystemEventPublisherService` + `SystemEventsListener`
  (`libs/api/matrix/src/lib/`) — resolves actor/target snapshots (with a
  historical "Deleted {kind}" fallback, brief §20), dedupes by idempotency key
  within a 30s window (brief §30), mentions the affected person's own Matrix id
  so notifications route through their existing preferences (brief §24) rather
  than pinging the room.
- **Domain events wired end-to-end** (`AppEvent` in `@org/api-common`,
  emitted only after the underlying write actually succeeds — brief §22):
  - Channel membership: join/leave/add/remove, self vs. admin-initiated
    (`ChannelService`, existing `ChannelMembershipChanged` — no new emit
    needed, just a new listener reading the existing `actorId`/`userId` pair).
  - Channel ↔ AI Agent / AI Coworker links: add/remove/enable/disable, one
    event pair covering both entity kinds (`AgentsService`, `CoworkersService`).
  - Channel ↔ App links: **new** `ChannelIntegration` model + migration
    (mirrors `ChannelAgent`/`ChannelCoworker` exactly) + service/controller in
    `IntegrationsService`/`ChannelAppsController`, because apps previously had
    no channel-scoped installation concept at all — only workspace/personal
    `ExternalIntegration`. This is what makes "Outlook Calendar APP was added
    to #agent45 by VR" a real, first-class action.
  - App connect/disconnect (workspace/personal scope) — posts into the app's
    own DM room when one already exists.
  - Channel archived/restored (new `ChannelArchiveChanged` event —
    `setArchived` didn't emit anything before).
  - Channel renamed (new `nameChanged` flag on `ChannelUpdatedEvent` — the
    existing payload always carried the *current* name for UI refresh, so a
    boolean was added rather than repurposing that field).
- **Frontend**: `SystemEventCard` + primitives (`SystemEventIcon`,
  `SystemEventEntityAvatar`, `SystemEventEntityBadge`, `SystemEventEntityName`,
  `SystemEventAction`, `SystemEventTimestamp`, `getSystemEventActions`) in
  `@org/chat-ui`, registered into the existing `MessageRenderer` switch
  alongside every other card type. Reuses the existing reaction picker,
  dropdown-menu and avatar system verbatim — no second implementation.
  Entity clicks route through `ChatSurface` → `ChatPanel` → real navigation
  (member → existing profile panel; agent/coworker/app → their existing chat
  routes) or `channel-page.tsx`'s existing `canManageChannel` for the
  admin-only "Delete event" menu item, which reuses the existing message
  delete/redact path.
- **Tests**: `system-event-publisher.service.spec.ts`,
  `system-events.listener.spec.ts`, emit-path specs on `ChannelService`,
  `AgentsService`, `CoworkersService`, `IntegrationsService`, and
  `system-event-card.spec.tsx` (rendering, deleted entities, permission-gated
  menu, a11y label, reaction reuse). `pnpm nx run-many -t typecheck,lint,test`
  is green across every touched project.

## Explicitly deferred (not started, or started but not wired to a page)

1. ~~**"Add app to channel" UI.**~~ **Done** (superseded by commits
   `d88a78b`/`b8fafbb`, after this doc was written). The old
   `channel-agents-and-apps-view.tsx` mock no longer exists in `src`. The real
   flow is `ChannelDetailsPanel`'s "apps" tab
   (`libs/web/channels/src/lib/components/channel-details-panel.tsx`) backed
   by `useChannelApps`/`useChannelAppMutations` and `AddAppDialog.tsx`
   (workspace `ExternalIntegration`s via `useIntegrations`), wired from
   `channel-page.tsx` and calling the real `ChannelAppsController` API
   end-to-end.
2. **Group DM / 1:1 DM membership events.** DMs and group DMs are created and
   managed entirely client-side (`MatrixClient.getOrCreateDirectMessage` /
   `getOrCreateGroupDirectMessage`, `useCreateConversation`) — there is no
   backend `AppEvent` for "added to a group DM" to hook. The client already has
   everything needed to post one itself (`MatrixClient.sendStructuredMessage`,
   used identically by `AgentMatrixBridgeService` server-side) — wiring group-DM
   participant add/remove to emit a `mie.system_event` as the current user is
   the natural next step, not started here.
3. **Workspace-level `member_role_changed`/`permissions_changed`.** No
   channel-role-change endpoint exists yet (`ChannelService` sets a role only
   at add-time), and workspace role changes (`WorkspaceMembershipChanged`)
   have no channel-scoped room to post into. The event types exist in the
   union for when a write path is added; nothing emits them today.
4. **`channel_created` / `channel_description_updated` timeline entries.** A
   channel's Matrix room is provisioned lazily (first time someone opens the
   channel), not at creation — so there's no room yet at the moment
   `ChannelCreated` fires. `channel_description_updated` has an event type and
   a card branch but no emit site.
5. **i18n**: `systemEvents.*` keys were added to `en.ts` only
   (`libs/shared/i18n/src/lib/locales/en.ts`). `@org/i18n`'s `translate()`
   already falls back to English for a missing key in any other locale, so
   nothing is broken — but the other 9 locale files don't have real
   translations yet. The rendered `SystemEventCard` itself doesn't call
   `@org/i18n` at all; it hardcodes English sentences the same way every
   other `@org/chat-ui` card does today (`chat-bubble.tsx`,
   `agent-message-card.tsx`, …) — **none** of `@org/chat-ui` is wired to
   `@org/i18n` yet, which is a pre-existing gap, not something this feature
   introduced. The sentence-building logic is centralized in one function
   (`getSentenceParts` in `system-event-card.tsx`, mirroring
   `formatSystemEventFallbackText`), so swapping in real translation calls
   later is a localized change.
6. **Search.** Message-body search across the platform is already out of
   scope for the existing chat system (Matrix rooms can be end-to-end
   encrypted; the codebase's own prior audit notes "msg-body search
   deferred=Matrix/E2EE"). System events inherit that same limitation rather
   than getting bespoke indexing — no new search engine was built, per the
   brief's own instruction not to build one.
7. **Timeline `Activity` filter.** Not investigated — depends on whatever
   message/attachment filter UI a channel/DM view already has, which wasn't
   traced as part of this pass.
8. **Notification digest / push copy.** System events participate in the
   existing Matrix push-rule pipeline automatically (a mention on
   `member_added`/`member_removed` targets the affected person specifically),
   but no dedicated "New activity" push template was added beyond that.
9. **Exhaustive test matrix (brief §36).** Core paths are covered (see above)
   but not the full cross-product — mobile/desktop visual QA, dark/light
   screenshot diffing, multi-client realtime races, and reconnect/duplicate
   WebSocket-event scenarios were not separately tested (realtime here is
   Matrix `/sync`, not a custom WebSocket layer, so "duplicate websocket
   event" maps to "duplicate Matrix event", which the idempotency-key dedupe
   in `SystemEventPublisherService` covers, but wasn't exercised end-to-end
   against a real homeserver).
