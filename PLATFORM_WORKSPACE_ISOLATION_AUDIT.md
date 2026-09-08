# Platform Workspace Isolation Audit

**Date:** 2026-09-08
**Scope:** Whole platform — every workspace-scoped surface (data, settings, theme,
cache, realtime, files, search, notifications, desktop).
**Trigger:** Changing theme / accent / appearance in one workspace changed it
everywhere.

---

## 1. Verdict

| Layer | State before this pass |
|---|---|
| **Database ownership** (`workspaceId` on every workspace entity) | ✅ Isolated |
| **API authorization** (`WorkspaceRoleGuard` + `/workspaces/:id/...`) | ✅ Isolated |
| **Server-side query filtering** (`WHERE workspaceId = ?`) | ✅ Isolated |
| **TanStack Query cache keys** (`['<feature>', workspaceId, …]`) | ✅ Isolated |
| **Realtime SSE stream** (server membership check + per-workspace fan-out) | ✅ Isolated server-side |
| **Realtime client wiring** (active workspace never handed to `RealtimeProvider`) | ❌ **Leak — fixed** |
| **Theme / appearance / branding** (stored per *user*, applied globally) | ❌ **Leak — fixed** |
| **Workspace "accent color"** (edited on General form, applied nowhere; 2nd editor) | ⚠️ **Dead — fixed** |

The platform was already built as a multi-workspace system with the workspace as
a real data boundary. The reported bug was **not** a missing `workspaceId`
somewhere — it was that **appearance is the one piece of state the product
stored per user and painted globally**, plus one unwired prop on the realtime
provider.

---

## 2. What was already correct (preserved, not rebuilt)

### 2.1 Database — every workspace entity carries `workspaceId`
`prisma/schema.prisma`: `Channel`, `Project`/`Task`/`Epic`/`Cycle`/`Initiative`/
`Module`/`Milestone`/`Sprint`, `Upload`, `AIAgent`/`AIChatSession`/`AIMemory`/
`PromptTemplate`, `AutomationWorkflow`, `ExternalIntegration`, `Notification`/
`NotificationPreference`, `RecentActivity`, `CalendarEvent`/`Meeting`,
`WorkDocument`/`Whiteboard`, `SavedView`, `WorkItemCustomField`,
`MarketplaceInstallation`, `AnalyticsEvent` … all have `workspaceId` with an FK
and `onDelete: Cascade`, and composite indexes (`@@index([workspaceId, …])`).
`WorkspaceMember` (`@@unique([workspaceId, userId])`) is the membership edge.

### 2.2 API — one guard, one convention
`WorkspaceRoleGuard` ([libs/api/auth/src/lib/guards.ts:100‑175](libs/api/auth/src/lib/guards.ts))
resolves `:workspaceId` **or** `:workspaceSlug` from the route, loads the
caller's `WorkspaceMember` row, and:
- returns **404** (not 403) to non-members and suspended members — existence is
  private;
- stamps `request.workspaceId / workspaceRole / workspacePermissions / workspacePlan`;
- refuses mutations on an `ARCHIVED` workspace unless `@AllowArchivedWorkspace()`.

19 controllers mount it; 14 use the nested `path: 'workspaces/:workspaceId/<feature>'`
form (`channel`, `member`, `search`, `notifications`, `storage`, `agents`,
`automations`, `ai`, `prompt-template`, `work-tools`, `meetings`, `billing`,
`user`, and now `workspace-settings`). Capability gating is
`@RequireWorkspacePermissions(WorkspacePermission.*)` against the shared grant
table in [libs/shared/types/src/lib/permissions.ts](libs/shared/types/src/lib/permissions.ts) —
the same table the browser reads, so buttons and the server never drift.

### 2.3 Server-side filtering
Spot-checked and confirmed `WHERE workspaceId = ?` at the query layer (not just
the guard):
- `SearchService` — every category query (`channels`, `documents`, `uploads`,
  `tasks`, `projects`) is `WHERE "workspaceId" = ${workspaceId}`
  ([libs/api/search/src/lib/search.service.ts](libs/api/search/src/lib/search.service.ts)).
- `NotificationsService` — preferences keyed `userId_workspaceId`; muted channels
  re-checked `{ id: {in…}, workspaceId }`
  ([libs/api/notifications/src/lib/notifications.service.ts](libs/api/notifications/src/lib/notifications.service.ts)).
- `UploadService` — context resolution re-checks every parent id against
  `workspaceId` before listing/attaching
  ([libs/api/storage/src/lib/upload.service.ts](libs/api/storage/src/lib/upload.service.ts)).
- `WorkspaceService.findBySlug` — non-members get 404.

### 2.4 Cache keys already namespaced by workspace id
[libs/shared/api-client/src/lib/query-keys.ts](libs/shared/api-client/src/lib/query-keys.ts):
`channels`, `members`, `invitations`, `analytics`, `agents`, `automations`,
`integrations`, `uploads`, `promptTemplates`, `search`, `notifications`,
`billing`, `workTools` all take `workspaceId` as the second key segment, so
switching workspace naturally partitions the cache. `useWorkspace(slug)` uses
`keepPreviousData` so the shell never blanks on a switch.

### 2.5 Realtime — server side
`GET /realtime/stream` verifies `WorkspaceMember` for the requested workspace and
**401s** a non-member ([libs/api/realtime/src/lib/realtime.controller.ts:136‑153](libs/api/realtime/src/lib/realtime.controller.ts)).
`RealtimeGatewayService.broadcastToWorkspace` fans out only to clients registered
under that workspace id **and** re-checks `WorkspaceMember … status: 'ACTIVE'`
([libs/api/realtime/src/lib/realtime-gateway.service.ts](libs/api/realtime/src/lib/realtime-gateway.service.ts)).
Events carry `workspaceId`.

### 2.6 User-level preferences already separated correctly
`User.preferredLanguage` + `useI18nStore` (`LanguageSync` in
[apps/web/src/app/providers.tsx](apps/web/src/app/providers.tsx)) — language is a
genuine per-user preference and stays one. `NotificationPreference` is keyed
`userId_workspaceId` — already per-user *and* per-workspace.

---

## 3. Findings & fixes

### F1 — Theme / appearance / branding was global (root cause) — **FIXED**

**Was:**
- `model ThemeSetting { userId @unique }` — one appearance blob per user, synced
  via `/users/me/theme` ([libs/api/user/src/lib/user.service.ts:290](libs/api/user/src/lib/user.service.ts)).
- `ThemeProvider` persisted to the **global** keys `onetab.theme`,
  `onetab.density`, `onetab.accent`, `onetab.radius`, `onetab.custom_theme`; the
  pre‑paint `<script>` in `apps/web/index.html` / `apps/admin/index.html` read
  the same global keys.
- `Workspace.accentColor` existed but was never applied to the design system.
- Net effect: a theme change in Workspace A wrote the user's row + global
  localStorage and repainted every workspace.

**Now — workspace is a first-class boundary for appearance:**

| Piece | Change |
|---|---|
| `prisma/schema.prisma` | `+ model WorkspaceSettings { workspaceId @unique, theme Json }` (workspace default / branding); `+ model WorkspaceThemePreference { @@unique([workspaceId, userId]), data Json }` (a member's per-workspace override). `ThemeSetting` **untouched** → becomes the user-global fallback so nobody's look changes on upgrade. |
| Migration `20260908120000_add_workspace_scoped_appearance` | Both tables + FKs/indexes; backfills `WorkspaceSettings.theme.accent` from a valid legacy `Workspace.accentColor`. |
| `@org/types` `appearance.ts` | `resolveWorkspaceAppearance({ memberOverride, workspaceDefault, userGlobal })` — field-by-field precedence: **member override → workspace default → user-global → design-system default**. `customTheme` atomic (explicit `null` still overrides). Shared by API and web. |
| `@org/api-workspace` | `WorkspaceSettingsController` at `/workspaces/:workspaceId/settings/appearance` — `GET` (any member; returns every layer + `resolved` + `canManageDefault`), `PUT …/default` (`MANAGE_SETTINGS`), `PUT/DELETE …/me` (any member, allowed while archived). Reuses `themeSettingSchema` + the shallow-merge idiom from `UserService.saveThemeSetting`. |
| `@org/api-client` | `workspaceApi.appearance / saveWorkspaceAppearance / saveMyWorkspaceAppearance / resetMyWorkspaceAppearance`; `queryKeys.workspaces.appearance(workspaceId)` (keyed by **id**, drops on switch). |
| `@org/design-system` `ThemeProvider` | New `scopeKey` prop → every storage key becomes `…::<workspaceId>`; unscoped keys still written as a "last painted" mirror. On `scopeKey` change it re-hydrates from the new namespace (empty ⇒ design-system default, **never** the previous workspace's values). Public `useTheme()` API unchanged, so the existing `ThemeSettings` / `ThemeCustomizer` keep working and now edit the active scope. `themeInitScript` + both `index.html` pre-paint scripts read `onetab_active_workspace_id` then the scoped keys, falling back to unscoped. |
| `apps/web` | `WorkspaceThemeScope` feeds `scopeKey={activeWorkspaceId}`; `WorkspaceAppearanceSync` (replaces `useThemeSync`) applies the workspace's `resolved` blob and debounces the user's changes to `…/appearance/me`; with no active workspace it falls back to `/users/me/theme`. `activeWorkspaceId` comes from `useActiveWorkspaceId()` — a `useSyncExternalStore` over `localStorage[onetab_active_workspace_id]` + an `onetab:active-workspace` event fired by `persistActiveWorkspaceId` — so app-level providers need no import of the lazy-loaded `@org/web-workspace`. |
| Settings UI | New **Workspace Settings ▸ Appearance & Branding** section + `WorkspaceAppearanceSettings` (mode / accent / brand preset / density / radius; read-only without `MANAGE_SETTINGS`). Account-level **Appearance & Preferences** now explicitly edits *your* look *for the current workspace*. The dead `accentColor` control on the General form is replaced by a pointer to the new panel. |
| Tests | `appearance.spec.ts` (precedence, `null` semantics, A/B independence); `workspace-settings.service.spec.ts` (layering, `canManageDefault`, override never touches the default, two-workspace isolation); `theme-provider-scope.spec.tsx` (`scopeKey` namespacing, no cross-workspace leak, re-hydrate on switch). |

### F2 — Realtime provider never told the active workspace — **FIXED**

**Was:** `RealtimeAppBridge` rendered `<RealtimeProvider userId={user?.id}>` with
**no `workspaceId`** ([apps/web/src/app/providers.tsx](apps/web/src/app/providers.tsx)).
Consequences: the SSE stream connected with `workspaceId=null` so the client was
never placed in the gateway's per-workspace client map (missing
`broadcastToWorkspace` events), and the provider's cache-invalidation effect used
`ws = workspaceId ?? ''` → invalidated `['channels','']`, `['members','']`, … which
match nothing.

**Now:** `<RealtimeProvider userId={…} workspaceId={activeWorkspaceId}>`.
`RealtimeClient.setWorkspace()` already reconnects the stream with the new scope
on change ([libs/shared/realtime/src/lib/realtime-client.ts:110](libs/shared/realtime/src/lib/realtime-client.ts)),
so switching workspace now: unsubscribes A, subscribes B, and invalidates
`['<feature>', B, …]`.

### F3 — `Workspace.accentColor`: a second, dead theme editor — **FIXED**

Edited on **General Settings** (`workspace-settings-page.tsx`), persisted, but
never read by the design system. Left in place it would contradict the new
Appearance & Branding panel. The control is removed (replaced by a link to the
new panel); the column stays for backward compatibility and the migration seeds
`WorkspaceSettings.theme.accent` from it.

---

## 4. Section‑24 checklist — per workspace-scoped feature

Key: **knows** = component/hook has the active workspace id · **API** = server
validates membership · **DB** = query filters by workspace · **cache** = query
key includes workspace id · **RT** = realtime validates workspace · **switch** =
switching workspace refreshes it · **leak** = can A's data appear in B.

| Feature | knows | API | DB | cache | RT | switch | leak | Notes |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Channels | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | `@@unique([workspaceId, slug])` |
| DMs / Group DMs | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | Matrix rooms brokered per user; membership server-checked |
| Projects / Tasks / Cycles / Initiatives | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | `workTools` keys carry `workspaceId` |
| Files / Uploads / Assets | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | `resolveContexts` re-checks every parent id vs `workspaceId` |
| AI agents / AI chat / prompts | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | `agents`/`promptTemplates` keys carry `workspaceId` |
| Apps / Integrations / Webhooks | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | `ExternalIntegration.workspaceId`; `integrations` keys carry it |
| Automations / Workflows | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | |
| Notifications / Mentions | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | `NotificationPreference` keyed `userId_workspaceId` |
| Search | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | every category `WHERE workspaceId` |
| Members / Roles / Invitations | ✅ | ✅ | ✅ | ✅ | ✅¹ | ✅ | No | |
| Saved views / custom fields / labels / statuses | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | all under `WorkItem*` with `workspaceId` |
| Analytics | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | `analytics.platform` is deliberately global |
| Billing / Subscription | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | `WorkspaceSubscription` 1:1 |
| Notification/chat prefs (per user) | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | No | correctly per (user, workspace) |
| Sidebar customization | ✅ | ✅ | n/a | ✅ | n/a | ✅ | No | `SidebarPreference.data` holds *per-workspace* ordering inside one per-user blob — acceptable (client merges by workspace) |
| **Theme / accent / branding** | ✅ **(fixed)** | ✅ **(new)** | ✅ **(new)** | ✅ **(new)** | n/a | ✅ **(fixed)** | **No (was Yes)** | F1 |
| **Realtime event routing (client)** | ✅ **(fixed)** | ✅ | — | ✅ **(fixed)** | ✅ | ✅ **(fixed)** | **No (was Yes)** | F2 |
| Language (per user, cross-workspace) | ✅ | ✅ | ✅ | ✅ | n/a | n/a | No — by design | `User.preferredLanguage` |

¹ Realtime is workspace-isolated **server-side** (stream membership check +
per-workspace fan-out). The client now also connects with the active workspace
id (F2), so per-workspace broadcasts are received and cache invalidations hit the
right keys.

---

## 5. Residual / follow-ups (not blocking, not in this pass)

1. **`SidebarPreference`** keeps per-workspace ordering inside a single per-user
   JSON blob. It doesn't leak (the client indexes by workspace id), but a
   `WorkspaceThemePreference`-style split would be tidier if it grows.
2. **`Workspace.accentColor` column** is now write-only legacy. Drop it in a
   later migration once no client reads it.
3. **Custom brand theme (full palette editor)** for the *workspace default* uses
   the preset picker only; wiring the full `ThemeCustomizer` to the
   workspace-default scope is a UI-only follow-up (the storage + resolver already
   support an arbitrary `customTheme`).
4. **Desktop** needs no separate work: `apps/desktop` native chrome follows
   `useTheme().resolvedTheme` via `DesktopProvider`, which is now workspace-scoped
   automatically.

---

## 6. How to verify

See `PLAN` verification section — in short: two workspaces, set A = Dark/Blue and
B = Light/Green, switch A→B→A (no reload, each restores its own look);
DevTools ▸ Local Storage shows `onetab.theme::<id>` keys and switching never
mutates the other workspace's keys; `PUT …/appearance/default` as a non-admin ⇒
403; any `…/settings/appearance` for a workspace you don't belong to ⇒ 404; a
task/channel event in A while viewing B does not invalidate B's lists.
