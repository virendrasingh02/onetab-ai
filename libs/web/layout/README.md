# @org/web-layout

The application shell: channel sidebar, header and right panel.

## Design

Desktop-first three-column layout — sidebar, content, assistant. The shell owns navigation chrome only; every route renders through its `<Outlet>` behind a per-route error boundary keyed on the pathname.

There is no separate workspace rail: switching workspaces lives in `<WorkspaceMenu>` at the top of the sidebar, and every destination the rail listed is reachable from the sidebar nav.

Sidebar rows share one geometry ramp from `nav-primitives`. `depth` (`0 | 1 | 2`) is the only indentation knob and drives padding, type size and icon size together, so top-level links, section rows and tree children stay in step. Rows use `navRowClass`, add/browse affordances use `navActionClass`, nested group headers use `navGroupHeaderClass`.

## Surface

- `<AppShell>` — the layout route for `/w/:workspaceSlug`.
- `<WorkspaceMenu>` — workspace switching and workspace-level destinations.
- `<ChannelNav>` — Favorites / Channels / Browse / Archived, with optimistic starring.
- `<AppHeader>` — search trigger, notifications, theme and account menu.

## Notes

The right panel renders behind a toggle so the three-column structure is already in place for threads and channel details.

## Commands

```sh
nx lint @org/web-layout
nx typecheck @org/web-layout
```
