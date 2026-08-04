# @org/design-system

Design tokens and the theme system.

## Design

Tailwind v4 has no config file: tokens are CSS custom properties exposed to utilities through `@theme inline`. Light and dark pairs are authored in OKLCH so they stay perceptually matched.

## Surface

- `styles/theme.css` — token definitions, base layer and the `dark` variant.
- `<ThemeProvider>` / `useTheme()` — light | dark | system, persisted to localStorage.
- `themeInitScript` — inline script that applies the theme before first paint.
- `layout`, `breakpoints`, `avatarTint()` — values that must reach JavaScript.

## Notes

Consumers must `@import "tailwindcss"` before importing `theme.css`, and register library sources with `@source` so their classes are not tree-shaken.

## Commands

```sh
nx lint @org/design-system
nx typecheck @org/design-system
```
