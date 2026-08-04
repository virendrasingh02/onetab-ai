# @org/web-upload

File upload foundation.

## Design

Files are validated against the same `uploadRequestSchema` the API uses, so client and server rules cannot drift. Object URLs are revoked on removal to avoid holding whole files in memory.

## Surface

- `useFileUpload()` — staging, validation and previews.
- `<FileDropzone>` — drag-and-drop with a real file input behind it for keyboard users.

## Notes

Phase 2 covers selection and validation; the transfer is wired when the storage driver lands behind `POST /uploads`.

## Commands

```sh
nx lint @org/web-upload
nx typecheck @org/web-upload
```
