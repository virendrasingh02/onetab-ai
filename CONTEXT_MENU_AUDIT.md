# Context menu system — audit & implementation (2026-09-25)

## 1. What existed

| Piece | Where | State found |
|---|---|---|
| `ContextMenu` primitives (Radix `react-menu` + virtual anchor) | `libs/shared/ui/.../context-menu.tsx` | Complete, tested, **used by no feature** (only the design-system studio demo). Uncontrolled only; trigger always wrapped children in a `select-none` `<div>`. |
| `DropdownMenu` + shared `menu-styles.ts` | `@org/ui` | Solid; every "⋯" menu in the app is hand-built on it (~70 files). |
| `ObjectActionMenu` | `@org/ui` | A second, parallel dropdown with its own item markup; "Open" did a full page reload. |
| `useLongPress` | `@org/hooks` | Used only by `ChatBubble` to pin the hover toolbar on touch. |
| `confirm()` / `usePromptDialog()` / `toast` | `@org/ui` | Fine; reused as-is. |

Every surface assembled its own "⋯" menu inline, so the same entity (a channel, a project) had different menus in different places and there was nowhere to hang a right-click.

### Bugs found and fixed along the way

- **Channel "Mark as unread" was a no-op** once the Inbox had been cleared. It back-dated the channel's seen-marker, but unread is computed from `max(channelSeen, workspaceSeen)`. Now it sets an explicit unread flag that clears when the channel is opened (`@org/notifications`).
- **DM "Mark as unread" was fake.** It only flipped the label to "Marked as unread!". It now uses the same flag for DMs, plus a real "Mark as read".
- **Meetings: Cancel and Delete ran with no confirmation**, even though the handlers were named `confirmCancel`/`confirmDelete`.
- **"Sharing & Permissions" (channel, doc and project rows) only copied a link.** Removed. Copy link is its own action.
- **"Project settings" in the sidebar just opened the board.** It now deep-links to the real settings view (`?view=settings`).
- **The channel row's "Unfollow" label actually toggled mute.** It's now labelled Mute/Unmute.
- **Rename and Archive on channel rows had no permission gating.** Both now follow the server's `assertCanManage`: channel admin, or `manage_settings`.
- **Duplicate menu entries:** "Workflow settings" was the same as "Edit workflow", "Permissions & scopes" the same as "Manage integration", and "Agent settings & tools" the same as "Open in Builder". The duplicates are gone.

## 2. Architecture

```
@org/ui  components/action-menu/
  action-model.ts    EntityAction type · resolveActionSections() · runEntityAction()
                     usePendingActions (in-flight dedupe) · registerEntityActions() registry
  action-menu.tsx    EntityContextMenu   right-click / Menu key / Shift+F10 / touch long-press
                     ActionDropdownMenu  the same list behind a "⋯" button
                     ActionSheet         touch bottom sheet (submenus drill in)
                     ActionContextMenu   controlled, opened at a point (React Flow nodes)
  action-helpers.ts  copyToClipboard() · entityUrl()
```

- **One list, three surfaces.** A feature describes an entity's actions once, as an `EntityAction[]`. The right-click menu, the "⋯" menu and the touch sheet all render that list, so they can't drift apart.
- **What an action can carry:** `id`, `label`, Lucide `icon`, `group` (separators go between groups), `shortcut` (single keys work while the menu is open), `hidden`, `disabled` + `disabledReason`, `destructive`, `checked`, `confirm`, `children` (submenu), `run` (sync or async), `successMessage`, `errorMessage`.
- **What running an action does:** skip if disabled → confirm if the action asks for it → in-flight dedupe keyed by `scope:id` (a pending action shows a spinner and can't be fired twice) → run → success or error toast.
- **Lazy evaluation.** Action lists are functions evaluated only when a menu opens, and nothing renders until then, so this is safe on every row of a virtualized list.
- **Native menu passthrough.** A right-click inside an input or contenteditable, or over a live text selection, still gets the browser's menu (Copy keeps working). With nested menus, the innermost one wins.
- **Opt-out for drag surfaces.** `longPress={false}` is for kanban cards, where a touch-hold starts a drag.
- **Registry for cross-module additions.** `registerEntityActions(type, provider)` lets another module add actions without the owning module importing it.
- **Shared builders:** `buildProjectActions` (`@org/web-work-tools`), `buildWorkflowActions` (`@org/web-automations`) and `buildObjectActions` (`@org/ui`). The sidebar and the page views use the same builder.

The repo is TypeScript throughout, so the system is written in TypeScript to match. It adds no new dependencies (Radix, Lucide, sonner and zustand were already in use).

## 3. Coverage

| Area | Surface | Actions |
|---|---|---|
| Chat messages | `ChatBubble` (all rooms, threads) | Reply in thread, **Quote** (new, inserts a `>` block into that conversation's composer), Add reaction ▸ (quick reactions and full picker), Save, Edit (own messages, within the edit window), Mark unread, Remind ▸, reply notifications, Copy text/link, Forward, link preview toggle, Organize ▸ (Pin, Assign, Context), Connect to apps ▸ (Task, Doc, AI), Delete (own messages or moderator). The "⋯" menu leaves out what the hover toolbar already shows. |
| Chat attachments | file header, file card, image tile | Preview, Download, Open in new tab, Copy link. Copy link is hidden for Matrix authenticated media, whose URLs would 401 for anyone else. |
| Sidebar | channels | Open, Mark read/unread, Favorite, Mute, Priority ▸, Move to section ▸, Copy link, Rename / Edit details / Add people (manage only), Leave (confirm), Archive (manage only, confirm) |
| | DMs, group DMs | Open, Mark read/unread, Favorite, Mute, Copy link, View profile |
| | docs, projects, agents, apps, workflows, coworkers | Per-type actions as in the builders. Projects add Archive/Restore and a permission-gated Delete. |
| Projects | gallery cards | Same list as the sidebar row (`buildProjectActions`), plus Export JSON |
| Kanban | task cards | Open, Assign to me, Assignees ▸, Status ▸, Priority ▸, Due date ▸, Move ▸, Duplicate, Copy link, **Convert to document** (new: creates the doc and links it), Delete (confirm) |
| Docs | Docs page tree | Open, Add subpage, Rename, Duplicate, Favorite, Move to folder ▸, Copy link, **Export as Markdown** (new), Delete (confirm) |
| Files | Files hub, project and conversation file lists (`UploadList`) | Preview, Download, View details, Go to source, Rename, Move/attach to project, Copy link (new `?file=` deep link), Delete (confirm) |
| Workflows | workflow list cards | Open, Run now, Enable/Disable, **Execution history** (new `?workflow=` filter on the logs page), Duplicate, Copy link, Export configuration, Delete (confirm) |
| Workflow nodes | builder canvas | Configure, Add connected node ▸, Duplicate, **Disable/Enable** (the engine now skips disabled nodes as `SKIPPED`), Copy configuration, Delete |
| Meetings | meeting cards | Open, Open link, Edit/Reschedule, Add participants, Duplicate, Copy link (new `?meeting=`), Copy join link, Cancel (confirm), Delete (confirm) |
| Calendar | today's agenda | Rename, Reschedule ▸, Duplicate, Copy details, Delete. Edit actions are organizer-only. |
| Members | members page | View profile, Message, Change role ▸, Remove (confirm). Role and Remove need `manage_members` and never apply to the owner or to yourself. |
| Saved | saved items | Open (in-app), Copy link, Remove bookmark, Related context, Ask AI |

**Permissions.** The client gates mirror the server guards (`@RequireWorkspacePermissions`, `assertCanManage`). The server still re-checks every request, so the client gates only decide what is shown.

## 4. Tests

- `@org/ui` `action-menu.spec.tsx` (16 tests): section resolution, hidden submenus, the disabled guard, in-flight dedupe, error handling, confirm (cancel and accept), the registry, right-click open, no wrapper element, in-menu shortcuts, native passthrough in inputs, innermost-wins nesting, the touch sheet, the disabled prop, and the dropdown parity.
- `@org/chat-ui` `message-renderer.spec.tsx` (4 new tests): the full right-click set, no edit/delete for non-moderators, moderator delete, and the native menu over a text selection.
- `@org/web-notifications` (2 new tests): the channel unread flag survives a cleared Inbox and clears when the channel is opened; DM flags work independently of channels.
- `@org/web-work-tools` `doc-export.spec.ts`: the Markdown serializer.
- Typecheck, lint and tests are green for `ui`, `chat-ui`, `web-chat`, `web-layout`, `web-work-tools`, `web-upload`, `web-automations`, `web-members`, `web-notifications` and `api-automations`.

## 5. Remaining gaps

- **HR / Finance:** no such record modules exist in the web app (only integration logos), so there is nothing to attach menus to.
- **Project "Duplicate":** no API copies a project's tasks. A settings-only copy would be misleading, so it's left out.
- **Task Archive/Restore:** tasks have no archived state in the API.
- **Channel "Manage members":** only the add-people dialog is reachable from the row. Removing members still happens in the channel's details panel.
- **`?file=` deep link:** only opens a file that is in the hub's loaded pages. A file further down needs a single-upload fetch.
- **Calendar month grid:** cells show dot markers, not event elements, so only the agenda list has event menus.
- **Chat conversation header:** room-level actions live in the sidebar row. The header keeps its existing menu.
- **Dev gotcha:** Vite 8 caches directory listings under `node_modules/@org/*`. After adding new files to a library, restart `nx serve @org/web`, or the imports 500 and the app renders a blank page.
