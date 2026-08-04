# @org/utils

Framework-agnostic helpers.

## Design

Pure functions only, so this library stays safe to import from anywhere (`type:util` may depend only on other utils and types).

## Surface

- `cn()` — clsx + tailwind-merge, which makes `className` overrides win predictably.
- Formatting: dates, relative times, byte sizes, abbreviated counts.
- Strings: `initials`, `slugify`, `truncate`, `escapeRegExp`.

## Notes

Covered by unit tests: `nx test @org/utils`.

## Commands

```sh
nx lint @org/utils
nx typecheck @org/utils
```
