# @org/web-search

Command-palette result rendering.

## Design

Rendering is split from the palette shell in `@org/ui`: the shell stays presentational while workspace-aware querying lives here.

## Surface

- `<WorkspaceSearchResults>` — grouped channel and people results.

## Notes

The palette shortcut (Cmd/Ctrl-K) is provided by `useCommandPalette()` in `@org/ui`.

## Commands

```sh
nx lint @org/web-search
nx typecheck @org/web-search
```
