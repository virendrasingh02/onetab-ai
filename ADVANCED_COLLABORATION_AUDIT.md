# Advanced Collaboration & Workspace Intelligence — Phase 1 Audit

**Date:** 2026-09-08 · **Branch:** `main` @ `253852c` · **DB:** Postgres reachable, 35 migrations applied, schema up to date.

Scope: the 23-section "Advanced Collaboration & Workspace Intelligence" brief. This
document is Phase 1 (Audit) only — it classifies every requested capability against
the current codebase and proposes a phased build. No feature code has been written yet.

---

## 1. Infrastructure that already exists and will be reused (not rebuilt)

| Concern | Where | Notes |
|---|---|---|
| Tenancy guard stack | `libs/api/auth/src/lib/guards.ts` | `JwtAuthGuard` (global) · `SystemRoleGuard` · `WorkspaceRoleGuard` — per-request membership re-check, 404-not-403, archived-workspace mutation freeze. Every new endpoint mounts under `/workspaces/:workspaceId/*` and gets this for free. |
| Permission vocabulary | `libs/shared/types/src/lib/permissions.ts` | `WorkspacePermission` = `view/create/update/delete/manage_members/manage_settings/manage_billing`. Grant table read by **both** server guard and client. New capabilities (e.g. `manage_channels`, `moderate_anonymous`) are added here once. |
| Typed event bus | `libs/api/common/src/lib/events.ts` | 28 `AppEvent`s, ~30 emit sites, 4 listener classes (notifications, RAG, automations, realtime bridge). This is the post-write hook for notifications/activity/realtime. |
| Cron | `@nestjs/schedule` — e.g. `libs/api/matrix/.../matrix-reconciler.service.ts` (`@Cron(EVERY_10_MINUTES)`) | The pattern for every expiration/applier job below. |
| Realtime | SSE `@Sse('realtime/stream')` + ticket handshake · `RealtimeGatewayService.broadcastToWorkspace` (re-checks `WorkspaceMember status:'ACTIVE'`) · `realtime-domain-bridge.listener.ts` · cross-replica via Redis pub/sub. Client: `libs/shared/realtime`. |
| Notifications | `Notification` model (`recipientId`, `readAt`, `deepLink`, `@@index([recipientId, readAt])`) · `NotificationsService` · `NotificationKind` enum · notification listener. |
| Search | `libs/api/search` — Postgres FTS, generated `tsvector` + GIN, `websearch_to_tsquery`. Categories: `channels · docs · files · tasks · projects · people`. Endpoint: `/workspaces/:workspaceId/search`. |
| Outbound mail | `libs/api/mail` (`@org/api-mail`) — `MailService.send()`, `log` + `http` transports, HTML-escaped templates. Wired into password reset + invitations. |
| Presence / status | `User.presence` (`ONLINE/AWAY/BUSY/OFFLINE`) + `statusText` + `statusEmoji` + `statusExpiresAt` — **one** status with **one** optional expiry. `presence.service.ts` emits `presence.updated`, caches per-user with 5-min TTL. |
| Sidebar | `libs/web/layout/src/lib/navigation/sidebar-store.ts` — Zustand + `persist`; server-authoritative copy via `SidebarPreference.data` (JSON blob) + `use-sidebar-sync.ts` (`PUT /users/me/sidebar`, 900 ms debounce). Fixed 8-id section union, per-item visibility/order, per-workspace `resourceOrders`, collapse, `@dnd-kit` drag. Activity dots via `SidebarActivityIndicator` (`@org/ui`). |
| Channels | `Channel` (`visibility` PUBLIC/PRIVATE, `isArchived`, `matrixRoomId`, pins, FTS vector) · `ChannelMember` (`role`, `isFavorite`, `isMuted`, `lastReadAt`, `joinedAt`) · `ChannelAgent` (added 2026-09-07). `channel.service.ts` — no posting gate, no mode. |
| Canvas / docs | `WorkDocument` (Notion-style block editor — `NotionBlockEditor.tsx`, `DocToolsDrawer.tsx`) **already extracts a heading outline** into an "Outline" drawer panel. `Whiteboard` (ReactFlow `canvasData` JSON) — no TOC concept (n/a). |
| Huddle / calls | `packages/matrix-client/src/lib/calls.ts` — `CallManager.startCall()` acquires real mic/camera media, drives call state, then **throws `UNSUPPORTED`**: MatrixRTC (MSC3401) signalling is deliberately deferred. `huddle-dock.tsx` (`@org/ui`) is a **portal slot only**. `Meeting` / `MeetingParticipant` / `MeetingNote` / `MeetingDecision` models exist for *scheduled* meetings. |
| Cross-device prefs pattern | `ThemeSetting`, `NavigationPreference`, `SidebarPreference`, `WorkspaceThemePreference` — one row per (user) or (user, workspace), `data Json`, validated on write, localStorage mirror for first paint. Copy this shape for new per-user settings. |

---

## 2. Feature matrix

`Exists` = works end-to-end today · `Partial` = some layer present · `Missing` = no code.

| # | Brief § | Feature | State | Evidence / gap | Action |
|---|---|---|---|---|---|
| 1 | §1.1 | Smart sidebar sections (recently active, unread-first, mentions, keyword, priority, project, user-created) | **Partial** | Manual only: fixed `SidebarSectionId` union, visibility/order/collapse/DnD, server-synced. No rules engine, no custom sections, no keyword match, no auto-update. | Extend the sidebar blob with `customSections[]` + `smartSections[]` (rule defs); client-side evaluator fed by existing channel/activity/mention queries; recompute on realtime events. Mostly client + JSON-schema widening. |
| 2 | §1.2 | Global channel sort modes (recent activity, last message, unread, mentions, frequency, priority, alphabetical, keyword, project, manual) + direction | **Partial** | Per-workspace **manual** DnD order only (`channelOrders`/`resourceOrders`). No sort modes, no direction, no per-user persisted choice beyond manual. | Add `channelSort: { mode, direction }` per workspace to the sidebar blob; derive ordering in `useGroupedChannels`; "frequency" needs a lightweight per-user visit counter (new tiny table or reuse `RecentActivity`). |
| 3 | §2 | Anonymous messaging (per-channel enable, role allowlist, anon identity, anon replies, moderation, report, audit) | **Missing** | Zero code. Messages are Matrix-native — sender identity = Matrix user, visible to all. | New `ChannelAnonymousSetting` + server-side **post proxy**: API posts as a shared "Anonymous Participant" Matrix identity, stores the real author in a restricted `AnonymousMessageAuthor` table readable only via `moderate_anonymous` permission + audit log. Report/remove flows. This is the most security-sensitive slice. |
| 4 | §3 | Announcement / broadcast channels (mode, posting allowlist, replies/reactions/uploads toggles, header badge) | **Missing** | `Channel.visibility` is PUBLIC/PRIVATE only. No posting policy; `channel.service` + Matrix room default power levels let any member post. | `Channel.mode` (`STANDARD`/`ANNOUNCEMENT`) + `postingRoleIds`/flags. Enforce in the send path **and** set Matrix room `power_levels.events_default` so the client is honest too. Header indicator via existing `channel-details-panel` / header. |
| 5 | §4 | Federated cross-workspace search (messages, channels, DMs, group DMs, files, projects, agents, apps, canvases, threads, people) + rich filters | **Missing** | `SearchService` is strictly single-workspace. No aggregator, 6 categories (no messages/DMs/threads/agents/apps/canvases), thin filter set. | New `SearchController` **without** `:workspaceId` in the path → fan out over the caller's `ACTIVE` memberships, run the existing per-workspace `SearchService`, merge + re-rank + dedupe, tag every row with workspace context. Add missing categories + filters (workspace, date, type, has-attachment/link, mentions, unread, exact phrase). Virtualized results UI (upgrade `libs/web/search`, don't fork). |
| 6 | §5 | Universal email integration (email → channel, thread → conversation, reply from platform, threading headers, attachments, loop guard) | **Missing** | Outbound mail only. Gmail *integration* provider is OAuth sync, not email-to-conversation. No inbound path, no per-channel address, no header preservation. | Decision needed on inbound transport (Postmark/Mailgun inbound webhook vs SMTP MX). Then `ChannelEmailAddress` + `EmailMessageLink` (`messageId`/`inReplyTo`/`references`/`matrixEventId`), parser, loop guard, attachment → `Upload`, post via Matrix with an `✉ Email` marker. Largest non-huddle slice. |
| 7 | §6 | Huddle voice/video stability, reconnect state machine, device recovery | **Missing (feature not built)** | No working transport — `startCall` throws `UNSUPPORTED`. There is nothing to make "reconnect reliably". | **Architecture decision required**: adopt Element Call / LiveKit / MatrixRTC. This is a project in itself. Recommend a separate initiative or an explicit descope to "who's in the huddle" presence + the deep link, no media. |
| 8 | §7 | Huddle thread history for new participants | **Missing** | Depends on §6. | After a transport exists: bind each huddle to its conversation (channel/DM/project), gate history by the **existing** membership check, render a "you joined at HH:MM" divider. |
| 9 | §8 | Temporary channel membership (24h/48h/1w/custom, auto-remove, extend, leave early, convert) | **Missing** | `ChannelMember` has `joinedAt`, no expiry or type. `channel.join()` upserts a permanent MEMBER. | `ChannelMember.expiresAt` + `membershipType` (`PERMANENT`/`TEMPORARY`). "Join temporarily" dialog. Cron sweep (matrix-reconciler pattern) removes expired rows + Matrix membership + emits `channel.membership.changed`. Extend / leave / convert endpoints. Server-side expiry, not a client timer. |
| 10 | §9 | Scheduled status multi-queue (≤5, one-time, recurring, date ranges, emoji, auto-expire, edit/delete/enable, conflict rule) | **Missing** | Single `User.status*` + one `statusExpiresAt`. `ScheduleView` is an unrelated work-tools calendar. | New `ScheduledStatus` model (≤5 enforced, `rrule`-ish recurrence, `startAt`/`endAt`, `priority`). Cron applier writes the winning entry into `User.status*`; deterministic conflict rule (most-recently-created, then narrowest window). Profile UI under the existing status popover. |
| 11 | §10 | Canvas table of contents (H1–H4, live, scroll-spy, active highlight, collapsible, stable anchors, duplicate-safe, mobile drawer) | **Partial** | `DocToolsDrawer` builds `headingBlocks` and renders a static "Outline" list in a side drawer. Missing: scroll-to on click (verify), active-section tracking, stable slug anchors, duplicate disambiguation, collapsible, responsive drawer, guaranteed rebuild on edit. | Promote the outline into the document surface as a real TOC component; add `IntersectionObserver` scroll-spy + slugged anchors (`heading-<slug>-<n>`); responsive drawer on compact widths. Client-only — no schema, no API. |
| 12 | §11 | Unified notification & activity intelligence for all of the above | **Partial (infra ready)** | Event bus + `Notification` + bridge exist; `NotificationKind` enum is fixed and has no members for anonymous / announcement / huddle / temp-membership / scheduled-status / canvas / email. | Per slice: add `AppEvent`(s), `NotificationKind`(s), a `notifications.listener` case and a `realtime-domain-bridge` case. No new infra. |
| 13 | §12 | Workspace isolation for every new entity | **Strong — follow the pattern** | `WorkspaceRoleGuard` + per-service `WHERE workspaceId` + query-key namespacing + per-workspace SSE fan-out; 2026-09-08 isolation audit closed the last leaks (theme, realtime client scope). | Every new model carries `workspaceId` FK + cascade + `@@index([workspaceId, …])`. Federated search is the **one** deliberate cross-workspace surface — it aggregates only over verified `ACTIVE` memberships. |

---

## 2a. Decisions taken (2026-09-08)

* **Start with Slice A** (smart sidebar + channel sort). ✅ **Done** — see §4.
* **Huddle transport (§6/§7):** Element Call / MatrixRTC (embed, stay in the Matrix stack).
* **Inbound email transport (§5):** provider inbound webhook (Postmark/Mailgun style), matching the existing `MAIL_TRANSPORT=http` posture.

## 3. Cross-cutting decisions needed before coding

1. **Huddle transport (§6/§7).** No media stack exists. Options: (a) LiveKit (self-host/cloud SFU) — most control, new infra; (b) Element Call embed — fastest, ties to Matrix; (c) descope to presence-only. This is the single biggest fork in the brief.
2. **Inbound email transport (§5).** Provider inbound webhook (Postmark/Mailgun — no MX ops, fastest) vs self-hosted SMTP/MX. Recommend provider webhook to match the existing `MAIL_TRANSPORT=http` posture.
3. **"Message" search category (§4).** Message bodies live in Matrix, not Postgres, and can be E2E-encrypted — server-side full-text over message content is not currently possible. Federated search over messages likely means per-workspace Matrix `/search` fan-out (slower, unranked) or accepting that messages are searched client-side only. Needs a call.
4. **Delivery model.** 12 features × (migration + API + guard + realtime + UI + tests) is a multi-PR program, not one change. Proposal below sequences it into independently shippable vertical slices, each ending green (`typecheck`/`lint`/`test`/`build`).

---

## 4. Proposed phased build (each slice = one end-to-end vertical, shippable alone)

| Order | Slice | Brief § | Size | New migration? | Notes |
|---|---|---|---|---|---|
| **A** | Smart sidebar sections + channel sort modes | §1.1, §1.2 | M | No (JSON blob widening only) | ✅ **DONE 2026-09-08** — see below. |
| **B** | Announcement / broadcast channels | §3 | M | Yes (`Channel` cols) | ✅ **DONE 2026-09-08** — see below. |
| **C** | Temporary channel membership | §8 | M | Yes (`ChannelMember` cols) | ✅ **DONE 2026-09-08** — see below. |
| **D** | Scheduled status multi-queue | §9 | M | Yes (`ScheduledStatus`) | ✅ **DONE 2026-09-08** — see below. |
| **E** | Canvas TOC | §10 | S | No | Client-only upgrade of the existing outline. |
| **F** | Federated cross-workspace search | §4 | L | No | ✅ **DONE 2026-09-08** — see below. |
| **G** | Anonymous messaging | §2 | L | Yes (3 models) | ✅ **DONE 2026-09-08** — see below. |
| **H** | Universal email integration | §5 | L | Yes (2 models) | Depends on decision #2. Inbound webhook + threading + loop guard + attachments. |
| **I** | Huddle transport + reconnect + thread history | §6, §7 | XL | Yes | Depends on decision #1. Realistically a separate initiative. |

Every slice: `@org/types` → `@org/api-client` endpoint → API controller/service/DTO + guard + `@RequireWorkspacePermissions` → Prisma migration (`migrate dev` — DB is live) → events/cron → UI on the existing design system with loading/empty/error/permission-denied/success states → vitest unit + a workspace-isolation test → `nx run-many -t typecheck lint test build` green.

### Slice A — Smart sidebar sections + channel sort modes ✅ (2026-09-08, uncommitted)

**No migration, no new endpoint.** The whole slice rides `SidebarPreference.data`
(the per-user JSON blob already synced by `PUT /users/me/sidebar` + `use-sidebar-sync`),
keyed by workspace id, so every setting is per-user, per-workspace and cross-device
with zero backend surface beyond widening one Zod schema.

| Layer | Change |
|---|---|
| Logic | New `libs/web/layout/src/lib/navigation/sidebar-sections.ts` — pure, unit-tested: `ChannelSortMode` (`default`/`alphabetical`/`recentActivity`/`unreadCount`/`mentions`/`frequency`/`priority`/`manual`) + direction, `SmartRule` union (unread, mentions, recently-active, frequently-visited, favorites, high-priority, keyword, needs-attention, project-match), `sortChannels`, `resolveSmartSection`, `resolveSidebarLayout` (manual sections claim channels exclusively; smart sections mirror), `buildChannelSignals`. |
| Store | `sidebar-store.ts` — `+ channelSort` / `sectionDefs` / `channelMeta` / `channelVisits` (all `Record<workspaceId, …>`), `setChannelSort` (auto default direction), section CRUD + reorder + collapse, `assignChannelToSection` (single-manual-section membership), `setChannelPriority` (0 clears), `recordChannelVisit` (tallied, pruned to 120), `resetChannelOrganization`. `partialize` + `resetAllPreferences` updated. |
| Sync | `use-sidebar-sync.ts` — new keys added to `PersistedSidebar` + `snapshot()`. |
| Server | `libs/shared/validation/.../profile.schema.ts` — `sidebarPreferencesSchema` pins the 4 new top-level keys, size cap 64 KB → 96 KB. That is the **only** backend change. |
| UI | New `channel-organization-menu.tsx` (sort mode + direction radio, "Manage sections…") in the Channels header · new `smart-sections-dialog.tsx` (add/rename/delete/reorder manual + smart sections, rule picker, keyword) · `channel-nav.tsx` renders resolved custom/smart sections above the catch-all "Channels" list, disables channel drag unless `mode === 'manual'`, adds "Priority" + "Add to section" submenus to the channel-row menu, records a visit on channel open · `nav-primitives.tsx` `Section` gained optional controlled `open`/`onOpenChange` for persisted per-section collapse · `app-shell.tsx` derives `channelLastActivity` from the notification feed and passes it down. Smart sections + sort recompute in `useMemo` over the live activity map, so they update on realtime activity with no refetch. |
| Tests | `sidebar-sections.spec.ts` (sort modes + directions, every rule, layout manual-exclusivity + smart-mirroring + ordering, **cross-workspace isolation**, signal derivation) · `sidebar-store.spec.ts` extended (per-workspace sort, section CRUD reindex, single-section membership, priority clear, visit prune, `resetChannelOrganization` scoping, persist round-trip). `nx affected -t lint typecheck test build` green (58 projects, `@org/web-layout` 61 tests). |

**Deliberately deferred within §1:** a pure "keyword relevance" *sort* (needs a
search-query context the sidebar doesn't have — the keyword *rule* covers the
use case), and a `Channel.projectId` link (project-match is by name today).

### Slice B — Announcement / broadcast channels ✅ (2026-09-08, uncommitted)

**Migration `20260908101946_channel_announcement_mode`** (hand-written — `migrate
dev` wanted to fold in a large pre-existing compliance-subgraph drift and emitted
an invalid `ALTER COLUMN "searchVector" DROP DEFAULT`; recovered via `migrate
resolve --rolled-back` + `migrate deploy`). Adds `ChannelMode` enum +
`Channel.{mode, allowReactions, allowReplies, allowFileUploads,
announcementPosterIds}`, all with safe defaults so every existing channel stays a
STANDARD channel with today's behaviour (§20).

**The real enforcement is the Matrix room's power levels**, because human
messages go browser→Synapse with no server hop. In announcement mode the room's
`events_default` is raised to PL50 (only authorized posters can send *any*
`m.room.message` — post, thread reply or upload), and `events["m.reaction"]` is
pinned to 0 or 50 per `allowReactions`. Matrix cannot tell a thread reply or an
upload apart from a root message, so `allowReplies` / `allowFileUploads` shape
the **client** affordances only (the server already blocks non-posters either
way) — documented, not a hole.

| Layer | Change |
|---|---|
| `@org/types` | `ChannelMode` enum; `Channel` + `ChannelSummary` (`+ canPost`) extended; new pure `channel-policy.ts` — `canPostInChannel` / `isAuthorizedAnnouncementPoster` / `canReplyInChannel` / `announcementPosterUserIds` (shared by API + web, like `permissions.ts`) + `channel-policy.spec.ts` (18 cases). |
| `@org/validation` | `updateChannelSchema` +`mode`/`allowReactions`/`allowReplies`/`allowFileUploads`/`announcementPosterIds`. |
| `@org/api-common` | `toChannel` serializer + `ChannelRow` extended; `events.ts` — real `ChannelUpdatedEvent` (`posting` block) + payload-map entry (the enum member existed but was unused). |
| `@org/api-channel` | `ChannelService.update()` accepts the new fields, validates `announcementPosterIds` are workspace members, emits `ChannelUpdated`; `list()`/`findBySlug()` derive `canPost` per caller via one extra workspace-role read + `toSummary()` helper. `assertCanManage` (channel admin ∨ workspace admin) unchanged. |
| `@org/api-matrix` | `MatrixAdminService.applyAnnouncementPolicy(roomId, …)` (one GET + one PUT of `m.room.power_levels`, every other key preserved); `MatrixAuthService.applyChannelPostingPolicy(channelId)` (resolves authorized poster Matrix ids, best-effort); called from `linkChannelToRoom` (new rooms locked immediately), from a new `@OnEvent(AppEvent.ChannelUpdated)` in `MatrixMembershipListener`, and as the `MatrixReconcilerService` cron backstop (announcement channels only, to spare Synapse). |
| Realtime | `ChannelUpdated` → existing `realtime-domain-bridge` `onChannelUpdated` → SSE `channel.updated` → client invalidates `['channels', ws]`, so the header badge + `canPost` + composer state refresh live. Zero new client wiring. |
| UI | `channel-page.tsx` — `Megaphone` "Announcement" badge in the header, a "Posting Permissions" item in the ⋯ menu (gated on `canManageChannel` = channel admin ∨ `manage_settings`), and `composerReadOnlyMessage` passed to `ChannelChat`. New `ChannelPostingDialog` (`channel-setup-dialogs.tsx`) — Standard/Announcement mode picker, Replies/Reactions/Uploads switches, a member multi-select for extra posters. `Composer` gained `readOnlyMessage` (replaces the input with a lock notice); threaded through `ChannelChat` → `ChatPanel` → `ChatSurface`. |
| Tests | `channel-policy.spec.ts` (STANDARD vs ANNOUNCEMENT, channel admin / creator / workspace admin / named poster / guest, `canReplyInChannel`, `announcementPosterUserIds` de-dupe). `nx affected -t typecheck lint test build` green (74 typecheck/lint, 35 test/build). |

**Deferred within §3:** an `@org/api-channel` controller/e2e spec (no test target on that lib yet); an "announcement post → notification" `NotificationKind` (needs the inbound-message classifier — pairs better with Slice H).

### Slice C — Temporary channel membership ✅ (2026-09-08, uncommitted)

**Migration `20260908110000_temporary_channel_membership`** (hand-written again).
Adds `ChannelMembershipType` enum + `ChannelMember.{membershipType, expiresAt}` +
an `@@index([membershipType, expiresAt])` for the sweep, and
`NotificationKind.CHANNEL_ACCESS_EXPIRED`. Every existing member is `PERMANENT`,
`expiresAt` null (§20).

Server-side expiry is the point — a `@Cron(EVERY_5_MINUTES)`
`ChannelMembershipExpiryService` (`@org/api-channel`, batched 200) deletes lapsed
`TEMPORARY` rows and per row emits `ChannelMembershipChanged` (leave — the Matrix
bridge kicks them) + `ChannelAccessExpired` (→ notifications listener →
`CHANNEL_ACCESS_EXPIRED` bell row → realtime). Our own auth re-checks
`ChannelMember` per request, so deleting the row revokes access immediately.

| Layer | Change |
|---|---|
| `@org/types` | `ChannelMembershipType` enum; `Channel.membership` + `ChannelMember` gain `membershipType`/`expiresAt`; `NotificationKind` +`CHANNEL_ACCESS_EXPIRED`. `channel-policy.ts` +`clampTempMembershipHours` / `temporaryExpiryFrom` / `extendedTemporaryExpiry` / `isTemporaryMembershipActive` / `TEMP_MEMBERSHIP_PRESETS` / bounds (`1h`–`90d`) + spec (10 cases). |
| `@org/validation` | `joinChannelSchema` (`durationHours?`), `extendMembershipSchema`. |
| `@org/api-common` | `toChannelMember` + `ChannelMemberRow` extended; `events.ts` — `ChannelAccessExpiredEvent` + `AppEvent.ChannelAccessExpired` + payload-map. |
| `@org/api-channel` | `join()` takes `durationHours` (read-then-decide: never downgrade a PERMANENT member; a `TEMPORARY` member joining plain → promote, with a window → never shorten); new `extendMembership()` (from later of now/current) + `convertToPermanent()` (public channels only); routes `POST :id/join` (now with body), `:id/membership/extend`, `:id/membership/convert-to-permanent`; new `ChannelMembershipExpiryService` cron; `+ @nestjs/schedule` dep + `ChannelModule` provider. |
| `@org/api-notifications` | `domain-events.listener` `@OnEvent(ChannelAccessExpired)` → `NotificationCenterService.create`. |
| Realtime | `realtime-provider` — a `NotificationCreated` of kind `CHANNEL_ACCESS_EXPIRED` also invalidates `['channels', ws]` so the swept channel leaves the recipient's sidebar at once (they have no mutation of their own to trigger it). |
| `@org/api-client` | `channelApi.join(…, input?)`, `extendMembership`, `convertMembershipToPermanent`. |
| UI | New `<JoinChannelControl>` (split button: press = permanent, caret = 24h / 48h / 1 week / custom dialog) on the browse page + channel header. New `<TemporaryMembershipBanner>` under the header (Extend ▾ / Make permanent / Leave). `Clock` "Temporary" badge in the header, a `Clock` glyph on the sidebar channel row, a "Temp · expires …" tag in the details-panel roster. Hooks: `useJoinChannel({channelId, durationHours})`, `useMembershipMutations`, `useLeaveChannel`. |
| Tests | `channel-policy.spec.ts` temp-membership block (clamp bounds/round, expiry math for live/lapsed/never windows, active check). `nx affected -t typecheck lint test build` green (74 each; `@org/types` 52 tests). |

**Deferred within §8:** an admin "Temporary Access" management tab (revoke others' temp access) — the details-panel roster already shows who has it and managers can remove them via the existing member menu; `@org/api-channel` service/e2e specs (no test target).

### Slice D — Scheduled status multi-queue ✅ (2026-09-08, uncommitted)

**Migration `20260908150000_scheduled_status_multi_queue`** (hand-written). New
`ScheduledStatus` model + `ScheduledStatusRecurrence` enum (`ONE_TIME` / `DAILY` /
`WEEKDAYS` / `WEEKLY`) + `User.scheduledStatusAppliedId`. Status stays a *user*
attribute (intentionally global, §12) — no workspace scoping.

`User.statusExpiresAt` had **no real expiry** before this — `getMe` masked an
expired status at read time but never cleared the row or told anyone. The
applier's second pass finally clears lapsed manual statuses too.

| Layer | Change |
|---|---|
| `@org/types` | `ScheduledStatusRecurrence` enum; new pure `scheduled-status.ts` — `localWallClock` (Intl, per-zone), `isScheduledStatusActive`, `pickActiveScheduledStatus` (**conflict rule: priority ↓, then updatedAt ↓, then id ↑**), `scheduledStatusWindowEnd`, `MAX_SCHEDULED_STATUSES = 5` + `scheduled-status.spec.ts` (12 cases: zones, WEEKDAYS/DAILY/WEEKLY, date bounds, one-time end-exclusive, conflict tiebreaks, window end). |
| `@org/validation` | new `scheduled-status.schema.ts` — `createScheduledStatusSchema` (`.superRefine` on recurrence-appropriate fields; no midnight-wrapping windows), `updateScheduledStatusSchema` (partial, for `{ isEnabled }` toggles). |
| `@org/api-common` | `toScheduledStatus` serializer; `events.ts` `UserStatusChangedEvent` + `AppEvent.UserStatusChanged` + payload-map. |
| `@org/api-user` | `ScheduledStatusService` (CRUD, ≤5 enforced, timezone seeded from `User.timezone`, delete clears the user's status if it was the active one) + `ScheduledStatusApplierService` (`@Cron(EVERY_MINUTE)`: apply/switch the winning entry, clear when the window closes, **never stomp a hand-set status** — `updateStatus` now nulls `scheduledStatusAppliedId` so manual wins; a second pass clears lapsed manual statuses; emits `UserStatusChanged`). Routes `GET/POST/PATCH/DELETE /users/me/scheduled-statuses[/:id]`. `+ @nestjs/schedule` + `@nestjs/event-emitter` deps. |
| Realtime | `realtime-domain-bridge` `@OnEvent(UserStatusChanged)` → `broadcastToWorkspace` per workspace id → `user.status.changed`; `@org/realtime` `RealtimeEventType.UserStatusChanged` + `realtime-provider` invalidates `['members', ws]` so rosters refresh live. |
| `@org/api-client` | `userApi.scheduledStatuses` / `createScheduledStatus` / `updateScheduledStatus` / `deleteScheduledStatus`. |
| UI | `@org/ui` `StatusModal` gained `onManageSchedules` → a "Scheduled statuses" row. New `@org/web-profile` `<ScheduledStatusDialog>` (list + inline add/edit form: emoji, text, name, recurrence segmented control, time-of-day / datetime pickers, weekly day chips, optional date bounds, priority, "set me to DND/Away") + `use-scheduled-statuses` hooks; wired in `app-shell.tsx`. |
| Tests | `scheduled-status.spec.ts`. `nx affected -t typecheck lint test build` green (74 each; `@org/types` 64 tests). |

### Slice F — Federated cross-workspace search ✅ (2026-09-08, uncommitted)

**No migration.** New `/search` endpoint (outside `/workspaces/:id`, `JwtAuthGuard` only) fans the existing per-workspace `SearchService` across every workspace the caller is an **ACTIVE** member of — membership is the security boundary, so it can't become a cross-tenant read.

| Layer | Change |
|---|---|
| `@org/types` | `SearchCategory` +`agents` +`canvases`; `SearchResultItem` +`score` +`timestamp`; new `FederatedSearchResultItem` / `FederatedSearchResponse` / `SearchWorkspaceRef`. New pure `federated-search.ts` — `mergeFederatedResults` (rank score↓ then recency then title; de-dup `people` by user id; page + `hasMore`; date/file-type/project post-filters) + `resolveSearchWorkspaces` + spec (6 cases incl. workspace-scoping). |
| `@org/api-search` | `search.service.ts` — +`agents` (AIAgent ILIKE) +`canvases` (Whiteboard ILIKE) categories; every result now carries `timestamp`; tasks metadata gains `projectId`. New `FederatedSearchService` (fan-out ≤25 workspaces, 12/category, merge) + `FederatedSearchController` at `GET /search?q&workspaceIds&categories&dateFrom&dateTo&fileType&projectId&page`. `+@org/types` +`@org/api-common` deps (ran `nx sync`). |
| `@org/api-client` | `searchApi.federated(...)` + `queryKeys.search.federated`. |
| UI | New `@org/web-search` `GlobalSearchView` — dedicated `/search` page (outside the workspace shell): debounced input, filter rail (workspace / type / date range / file type / **exact phrase** toggle that quotes the query), **`@tanstack/react-virtual`-virtualized** result list, infinite loading via the last-row sentinel, each row shows workspace context + relative time and links to `/w/{slug}/{href}`. Command palette gained a "Search all workspaces for ‘…’" footer link → `/search?q=`. Route added in `app.tsx`. |
| Tests | `federated-search.spec.ts` (`@org/types` 69 tests). `nx affected -t typecheck lint test build` green (65 projects). |

**Deferred within §4** (decision #3): message / DM / thread bodies — they live in Matrix and can be E2E-encrypted, so there is no server-side text index to federate; the `channel / user / has-attachment / has-link / mentions / unread` filters are message-search filters and N/A without that index. `agents`/`canvases` are name-only ILIKE. Cursor pagination (offset-page is used) and per-category result counts across workspaces.

**Deferred within §9:** a bell notification per scheduled flip (routine, deliberately noise — the realtime roster refresh + the user's own device on next `/users/me` covers it); the user's *own* device live-updating its auth-store status without a refetch; DST-exact `statusExpiresAt` display (the per-minute applier is the real expiry).

### Slice G — Anonymous messaging ✅ (2026-09-08, uncommitted)

**Migration `20260908160000_anonymous_messaging`** (hand-written). `ChannelAnonymousSetting` (per-channel config: `isEnabled`, `allowedRoles WorkspaceRole[]`, `allowReplies`, lazily-provisioned `matrixUserId`), `AnonymousMessage` (the de-anonymisation record: `matrixEventId ↔ authorId`, `removedAt`), `AnonymousModerationEvent` (append-only: `REPORT` / `REVEAL_AUTHOR` / `REMOVE_MESSAGE`) + `AnonymousModerationKind` enum. New `WorkspacePermission.MODERATE_ANONYMOUS` (granted OWNER + ADMIN).

**The security model:** human messages go browser→Synapse with the sender baked in, so an anonymous post goes through the server, which posts it into the room as a shared `@anon-<channelId>` "Anonymous Participant" identity (reusing `MatrixBotMessagingService`) and records the real author in `AnonymousMessage`. `authorId` is **never** serialised outside `revealAuthor` / `listAudit`, both `MODERATE_ANONYMOUS`-gated, and every reveal/removal writes an append-only `AnonymousModerationEvent`. Remove = `MatrixAdminService.redactEventAs` (new) via the anon identity.

| Layer | Change |
|---|---|
| `@org/types` | `MODERATE_ANONYMOUS` permission + grant; new `anonymous.ts` DTOs (`ChannelAnonymousSettingsView` with `canPostAnonymously`/`canModerate`, `AnonymousModerationRow` — **no author**, `AnonymousRevealResult`, `AnonymousModerationEventView`). |
| `@org/validation` | `anonymous.schema.ts` — settings / post / report / remove. |
| `@org/api-matrix` | `MatrixAdminService.redactEventAs`; new `AnonymousMessagingService` + `AnonymousController` at `/workspaces/:id/channels/:channelId/anonymous` — `GET/PUT settings`, `POST messages` (checks enabled + membership + role allowlist + `allowReplies`; provisions/joins the anon identity lazily; records `AnonymousMessage`), `POST messages/:eventId/report` (any member), `GET moderation` + `POST messages/:id/reveal` + `POST messages/:id/remove` + `GET audit` (`MODERATE_ANONYMOUS`). `+@org/api-auth` +`@org/validation` deps. |
| `@org/api-client` | `anonymousApi` (8 methods). |
| UI | `@org/ui` `Composer` gained an `anonymousPosting` toggle (a `VenetianMask` button + "posting as Anonymous Participant" banner; toggled send routes to `onSendAnonymously`), threaded `ChannelChat → ChatPanel → ChatSurface`. `ChannelPostingDialog` gained an auto-saving "Anonymous messages" section (enable + `allowReplies` + role chips). New `<AnonymousModerationDialog>` (Messages + Activity tabs; per-row Reveal author — confirm + logged — / Remove) opened from the channel ⋯ menu when `canModerate`. |
| Tests | `@org/types` permission grants unchanged-count check passes; `nx affected -t typecheck lint test build` green (74 projects). |

**Deferred within §2:** a member-facing "report" affordance on the message row itself (the `POST .../report` endpoint exists; wiring it needs a pass on the `@org/chat-ui` message context menu). "Selected groups" is roles only — the platform has no group concept. Anonymous messages currently render with the anon identity's default avatar/gradient; a dedicated "incognito" glyph is a follow-up.

### Slice H — Email-to-channel ✅ (2026-09-08, uncommitted)

**Migration `20260908170000_email_to_channel`** (hand-written). `ChannelEmailAddress` (per-channel inbound address: slugified `localpart @unique` + random suffix, `isEnabled`, `threadPerSubject`, lazily-provisioned `matrixUserId`), `EmailMessage` (the inbound record + loop guard: `messageId @unique`, `inReplyTo` / `references`, `fromAddress` / `fromName`, `subject`, `matrixEventId` / `matrixThreadRootId`, `attachmentCount`).

**The security model:** same as Slice G — a provider webhook `POST /email/inbound?secret=…` (`@Public()`, `INBOUND_EMAIL_SECRET`-gated) hands the server a parsed message; the server matches the channel by `localpart`, runs loop guards (dup `messageId`, own domain, `no-reply` / `mailer-daemon` / `postmaster` / `auto-submitted` patterns), resolves the thread root by `In-Reply-To` / `References` then subject, and posts into the room as a shared `@email-<channelId>` identity (`admin.sendEventAs`) with an `org.onetab.email` hint + `m.relates_to` thread. No inbound mail ever bypasses that path.

| Layer | Change |
|---|---|
| `@org/config` | `apiEnvSchema` +`INBOUND_EMAIL_DOMAIN` (default `inbound.onetab.ai`) +`INBOUND_EMAIL_SECRET` (optional). `.env.example` updated. |
| `@org/types` | new `email.ts` — `ChannelEmailSettingsView` (`address` / `isEnabled` / `threadPerSubject` / `messageCount`), `EMAIL_EVENT_KEY`, `EmailEventHint`. |
| `@org/validation` | `email.schema.ts` — `updateChannelEmailSettingsSchema` + lenient `inboundEmailSchema` (`.passthrough()` over Postmark / Mailgun shapes). |
| `@org/api-matrix` | new `InboundEmailService` (`ensureAddress` lazy-provision with collision retry, `normalise` / `normaliseSubject`, `handleInbound` with the guards above) + `ChannelEmailController` (`GET` / `PUT` at `/workspaces/:id/channels/:channelId/email`, `MANAGE_SETTINGS` for PUT) + `InboundEmailController` (`POST /email/inbound`, `@Public`, `@HttpCode(200)`). |
| `@org/api-client` | `channelEmailApi` (`settings`, `updateSettings`). |
| UI | `ChannelPostingDialog` gained an "Email integration" section (address + copy button, enable toggle, `threadPerSubject` toggle, message count) beside the anonymous section. |
| Tests | `nx affected -t typecheck lint test build` green (74 projects). |

**Deferred within §11:** outbound (channel reply → email back to the sender); attachment ingestion (the count is recorded, blobs are not pulled into `Upload`); per-address allow-lists / verified-sender enforcement; DKIM/SPF checks (delegated to the provider). Postmark/Mailgun field mapping is covered; SES's nested SNS envelope is not.

### Slice I — Huddles ✅ (2026-09-08, uncommitted)

**Migration `20260908180000_huddles`** (hand-written). `Huddle` (`workspaceId`, `channelId?`, `matrixRoomId`, `startedById`, `status HuddleStatus @default(ACTIVE)`, `startedAt` / `endedAt`), `HuddleParticipant` (`@@unique([huddleId, userId])`, `joinedAt` / `leftAt` — drives the "you joined at" marker, §7), `HuddleStatus` enum.

**The model:** our side owns the huddle record, its participants and the connection state; the media surface is Element Call (MatrixRTC) embedded client-side in the huddle's Matrix room when `ELEMENT_CALL_URL` is set, otherwise the huddle is presence-only. That room **is** the channel's / DM's room, so a late joiner's history is that room and authorization is exactly the room's membership. Leaving with nobody left auto-ends the huddle; the host (or a channel `ADMIN`) can end it for everyone.

| Layer | Change |
|---|---|
| `@org/config` | `apiEnvSchema` +`ELEMENT_CALL_URL` (optional URL). |
| `@org/types` | new `huddle.ts` — `HuddleView` / `HuddleParticipantView` / `HuddleConfig` DTOs + a pure `huddleConnectionReducer` (`connecting → connected → interrupted → reconnecting → connected`, and `reconnecting → failed` once `HUDDLE_MAX_RECONNECT_ATTEMPTS` run out — never a stuck spinner, §6) + `isHuddleConnecting` + `huddle.spec.ts` (6 cases). |
| `@org/validation` | `huddle.schema.ts` — `startHuddleSchema` (`channelId?` / `matrixRoomId?`, `.refine` one required). |
| `@org/api-common` | `AppEvent.HuddleUpdated` + `HuddleUpdatedEvent` (`action: started / joined / left / ended`). |
| `@org/api-matrix` | new `HuddleService` (`start` = join-if-exists-else-create, `forRoom`, `join`, `leave` — auto-ends when empty, `end` — host / channel-admin only; `resolveRoom` membership-checks the channel `ChannelMember` or the DM room via `admin.getRoomMembers`) + `HuddleController` at `/workspaces/:id/huddles` (`GET config`, `GET for-room?roomId`, `POST`, `POST :id/join`, `POST :id/leave`, `POST :id/end`). |
| `@org/api-realtime` | `RealtimeDomainBridgeListener` `@OnEvent(HuddleUpdated)` → `broadcastToWorkspace` `huddle.updated`. |
| `@org/realtime` | `RealtimeEventType.HuddleUpdated`; provider invalidates `['huddle', ws]`. |
| `@org/api-client` | `huddleApi` (`config`, `forRoom`, `start`, `join`, `leave`, `end`). |
| UI | New `@org/web-chat` `useHuddleSession(workspaceId, roomId)` — binds the room's huddle, runs the `huddleConnectionReducer` off `window` online/offline (and the Element Call iframe's load signal when embedded), auto-retries with backoff. `@org/chat-ui` `HuddleBar` extended: backend roster + "you joined HH:MM" + "started 5m ago", a reconnecting spinner line, a "Connection lost — Retry / Leave" state, `busy` disabling, and a compact embedded Element Call `<iframe>` when `ELEMENT_CALL_URL` is set. `ChatSurface` gained a `workspaceId` prop (passed from `ChatPanel`) and its local `huddleJoined` toggle is replaced by the hook; the decorative `huddleParticipants` prop is gone. |
| Tests | `huddle.spec.ts` (`@org/types`). `nx affected -t typecheck lint test build` green. |

**Deferred within §6/§7:** real MatrixRTC signalling / the exact Element Call widget-URL param contract (the embed is addressed by room and its load drives the state machine, but a deployed Element Call is needed to verify media); a host-only "End for all" button in the bar (the endpoint enforces it; the bar needs the caller's DB user id threaded through `ChatSurface`, which today only has the Matrix id); mute / screen-share / video are still local UI (client media concerns, no shared state); ringing / "N wants to huddle" invites; a huddle started from a DM/group carries `channelId = null` (resolved via room membership), so "end by channel admin" only applies to channel huddles.

---

## 5. What this audit does **not** change

No behavior changed. Existing channels stay `STANDARD` with today's permissions and sidebar position; existing single-status behavior is preserved as the fallback the scheduled-status applier writes into; the existing single-workspace `/workspaces/:id/search` stays as-is and the federated endpoint is additive.
