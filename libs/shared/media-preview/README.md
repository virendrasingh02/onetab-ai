# @org/media-preview

A single, reusable full-screen preview for any attachment — image, PDF, video,
audio, text/code, or an unsupported-type fallback — used from chat, AI-generated
files, custom app cards, the file manager and file search.

## Design

Presentational, like `@org/ui` and `@org/chat-ui`: it renders a `MediaItem`,
nothing more. It never fetches a file itself and never knows about uploads,
storage, or auth — a caller resolves a real URL (directly, or lazily via
`MediaItem.resolveUrl()` for sources that need an authenticated fetch, e.g. the
file manager's `Upload` entities) and hands this library a plain object. That
split is a module-boundary requirement, not a style choice: this lib is
`type:ui`/`scope:shared`, which may depend on `@org/ui`/`@org/design-system`/
`@org/types`/`@org/utils` but never on `@org/api-client`/`@org/upload`.

## Surface

- `<MediaPreviewProvider>` — mount once near the app root (alongside `<Toaster/>`).
  No React Context involved; the preview state is a module-level zustand store,
  same pattern as `useRightPanelStore` in `@org/ui`.
- `useMediaPreview()` — `{ openPreview, closePreview, next, previous, isOpen,
  activeItem, activeIndex, count }`.
- `<MediaPreviewTrigger>` / `<MediaThumbnail>` — a clickable wrapper/card that
  opens the preview for one item (optionally within a larger gallery).
- `getMediaType(mimeType, filename?)` — the one place file-type detection lives;
  every call site that used to duplicate this logic should use this instead.
- `attachmentToMediaItem` / `generatedFileToMediaItem` — adapters from this
  repo's existing `Attachment`/`GeneratedFile` types (`@org/types`). Sources this
  lib doesn't know about (e.g. `Upload`) build a `MediaItem` at the call site.

## Notes

**PDF rendering uses `pdfjs-dist` directly**, not `react-pdf` — pages/thumbnails
are lazily rendered and released as they scroll in and out of view, and search
extracts + caches text per page, none of which a per-`<Page>` wrapper helps
with. The worker is wired in `lib/pdf/pdf-worker.ts`; see that file's comment
for the Vite worker-bundling fallback chain if the default breaks on a future
Vite upgrade.

**Downloads always go through a fetch → blob → object URL → synthetic click**
(`lib/download-media-item.ts`), the same pattern already used by the file
manager's download mutation — not a bare `<a href>`, so it works uniformly for
authenticated blob sources too.

## Commands

```sh
nx lint @org/media-preview
nx typecheck @org/media-preview
nx test @org/media-preview
```
