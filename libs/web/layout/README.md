# @org/web-layout

The application shell: workspace rail, channel sidebar, header and right panel.

## Design

Desktop-first three-column layout. The shell owns navigation chrome only; every route renders through its `<Outlet>` behind a per-route error boundary keyed on the pathname.

## Surface

- `<AppShell>` — the layout route for `/w/:workspaceSlug`.
- `<WorkspaceSwitcher>` / `<WorkspaceMenu>` — the outermost navigation level.
- `<ChannelNav>` — Favorites / Channels / Browse / Archived, with optimistic starring.
- `<AppHeader>` — search trigger, notifications, theme and account menu.

## Notes

The right panel renders behind a toggle so the three-column structure is already in place for threads and channel details.

## Commands

```sh
nx lint @org/web-layout
nx typecheck @org/web-layout
```
