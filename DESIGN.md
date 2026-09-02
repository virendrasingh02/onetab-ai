# DESIGN.md

Visual and structural conventions for this project.

This is a **spec, not a dependency**. It works on top of the shadcn/ui + Radix components already
in `components/ui/`. Nothing here requires installing another library. Adopting it means:

1. pasting the CSS variables in §2 into your global stylesheet,
2. wiring the four theming axes — mode, palette, radius, density (§2.5–2.12),
3. adding a few variants to `button.tsx`, `badge.tsx`, and `alert.tsx` (§6),
4. following the sizing, spacing, and state conventions everywhere else.

Existing components keep working while you migrate — the new tokens are additive.

---

## 1. Principles

1. **Semantic tokens only.** No `bg-white`, no `text-gray-500`, no hex in component code. Write
   `bg-card`, `text-muted-foreground`, `border-border`. A literal palette class is a bug: it breaks
   dark mode and makes rebranding a find-and-replace job.
2. **Surfaces come in pairs.** Every `--x` has an `--x-foreground`. Use them together and contrast
   is handled.
3. **Borders carry structure, shadows carry elevation.** Flat surfaces divided by 1px hairlines.
   Shadow only on things that genuinely float.
4. **Density is a decision.** Data surfaces (tables, sidebars, toolbars) run on the `sm` scale;
   settings and marketing run on `md`.
5. **Compose, don't configure.** Small primitives with slots beat one component with thirty props.
6. **Motion answers an action.** Overlays and disclosures animate. Nothing animates on its own.
7. **Four states, always.** Default, loading, empty, error. A surface missing one is unfinished.
8. **RTL by construction.** Logical utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`)
   instead of left/right.

---

## 2. Tokens

### 2.1 What to add

Your shadcn install already defines `background`, `foreground`, `card`, `popover`, `primary`,
`secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-*`, `sidebar-*`.
Keep them. Add the five state tokens below — they're what alerts, badges, and status cells need in
order to look right in both modes.

```css
/* globals.css — append to your existing :root and .dark blocks */

:root {
  --destructive-foreground: var(--color-red-800);
  --info:                   var(--color-violet-500);
  --info-foreground:        var(--color-violet-900);
  --success:                var(--color-emerald-500);
  --success-foreground:     var(--color-emerald-900);
  --warning:                var(--color-yellow-500);
  --warning-foreground:     var(--color-yellow-900);
  --invert:                 var(--color-zinc-900);
  --invert-foreground:      var(--color-zinc-50);
}

.dark {
  --destructive-foreground: var(--color-red-600);
  --info:                   var(--color-violet-500);
  --info-foreground:        var(--color-violet-600);
  --success:                var(--color-emerald-500);
  --success-foreground:     var(--color-emerald-600);
  --warning:                var(--color-yellow-500);
  --warning-foreground:     var(--color-yellow-600);
  --invert:                 var(--color-zinc-700);
  --invert-foreground:      var(--color-zinc-50);
}
```

### 2.2 Exposing them to Tailwind

**Tailwind v4** — add to the `@theme inline` block you already have:

```css
@theme inline {
  --color-destructive-foreground: var(--destructive-foreground);
  --color-info:                   var(--info);
  --color-info-foreground:        var(--info-foreground);
  --color-success:                var(--success);
  --color-success-foreground:     var(--success-foreground);
  --color-warning:                var(--warning);
  --color-warning-foreground:     var(--warning-foreground);
  --color-invert:                 var(--invert);
  --color-invert-foreground:      var(--invert-foreground);
}
```

**Tailwind v3** — in `tailwind.config.ts` under `theme.extend.colors`. Note that v3 has no
`--color-*` palette variables, so write the OKLCH values directly in `:root` instead of the
`var(--color-emerald-500)` references above.

```ts
colors: {
  info:    { DEFAULT: 'hsl(var(--info))',    foreground: 'hsl(var(--info-foreground))' },
  success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
  warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
  invert:  { DEFAULT: 'hsl(var(--invert))',  foreground: 'hsl(var(--invert-foreground))' },
  destructive: {
    DEFAULT: 'hsl(var(--destructive))',
    foreground: 'hsl(var(--destructive-foreground))',
  },
}
```

(Use the `hsl()` wrapper only if the rest of your file already does. If your variables are raw
OKLCH, drop the wrapper and reference `var(--info)` directly.)

### 2.3 When to use which state

| Token | Meaning |
|---|---|
| `destructive` | Delete, revoke, failed, irreversible |
| `warning` | Needs attention, expiring, degraded, near limit |
| `success` | Completed, active, healthy, paid |
| `info` | Neutral notice, tip, new, non-blocking |
| `invert` | High-contrast chips and tooltips that flip with the theme |

Color never carries meaning alone — always pair with an icon or text label.

### 2.4 Brand color

If you have one, add it the same way rather than overriding `--primary`:

```css
:root { --brand: oklch(0.62 0.21 259); --brand-foreground: oklch(1 0 0); }
.dark { --brand: oklch(0.70 0.18 259); --brand-foreground: oklch(0.20 0 0); }
```

Then `bg-brand text-brand-foreground`. Rebrand = two lines.

---

### 2.5 Theming architecture

Theming runs on **four independent axes**. Keep them independent — the moment one axis leaks into
another you get combinatorial CSS that nobody can reason about.

| Axis | Carrier | Values |
|---|---|---|
| Mode | `.dark` class on `<html>` | light · dark |
| Palette | `data-theme` on `<html>` | `default` · your presets |
| Radius | `data-radius` on `<html>` | `none` · `sm` · `md` · `lg` |
| Density | `data-density` on `<html>` | `comfortable` · `compact` |

```html
<html class="dark" data-theme="ocean" data-radius="md" data-density="compact">
```

Any combination must work. That's the test for whether a preset is written correctly.

### 2.6 The preset contract

A palette preset may **only** override tokens from this list. This is the themeable surface:

```
--primary            --primary-foreground
--accent             --accent-foreground
--ring
--brand              --brand-foreground
--sidebar-primary    --sidebar-primary-foreground
--chart-1 … --chart-5
```

Full skins (rare — a whole different look, not just a brand color) may additionally override
`--background --foreground --card --card-foreground --popover --popover-foreground --muted
--muted-foreground --secondary --secondary-foreground --border --input --sidebar --sidebar-accent`.

Three hard rules:

1. **A preset never invents a token.** If `ocean` defines `--wave` and no other theme does, every
   component using `bg-wave` breaks on every other theme. Add it to the base for all themes or
   don't add it.
2. **State tokens are not themeable.** `success`, `warning`, `info`, `destructive` stay constant
   across palettes — status shouldn't change meaning because someone picked a different accent.
3. **Every preset defines both modes.** A preset with only a light block is broken by definition.

```css
/* themes.css — imported after globals.css */

[data-theme='ocean'] {
  --primary:              oklch(0.55 0.15 230);
  --primary-foreground:   oklch(0.99 0 0);
  --accent:               oklch(0.95 0.02 230);
  --accent-foreground:    oklch(0.35 0.08 230);
  --ring:                 oklch(0.55 0.15 230);
  --sidebar-primary:      oklch(0.55 0.15 230);
  --sidebar-primary-foreground: oklch(0.99 0 0);
  --chart-1: oklch(0.60 0.14 230);
  --chart-2: oklch(0.65 0.12 195);
  --chart-3: oklch(0.55 0.10 260);
  --chart-4: oklch(0.72 0.13 210);
  --chart-5: oklch(0.48 0.09 245);
}

.dark[data-theme='ocean'] {
  --primary:              oklch(0.70 0.13 230);
  --primary-foreground:   oklch(0.18 0.02 230);
  --accent:               oklch(0.30 0.04 230);
  --accent-foreground:    oklch(0.95 0.01 230);
  --ring:                 oklch(0.70 0.13 230);
  --sidebar-primary:      oklch(0.70 0.13 230);
  --sidebar-primary-foreground: oklch(0.18 0.02 230);
  --chart-1: oklch(0.72 0.13 230);
  --chart-2: oklch(0.76 0.11 195);
  --chart-3: oklch(0.66 0.10 260);
  --chart-4: oklch(0.80 0.12 210);
  --chart-5: oklch(0.60 0.09 245);
}
```

The `default` theme is the bare `:root` / `.dark` blocks — don't write a `[data-theme='default']`
block, or specificity fights start.

### 2.7 Radius axis

`--radius` is the only variable; the aliases in §3 derive from it.

```css
[data-radius='none'] { --radius: 0rem;     }
[data-radius='sm']   { --radius: 0.375rem; }
[data-radius='md']   { --radius: 0.625rem; } /* default */
[data-radius='lg']   { --radius: 1rem;     }
```

At `none`, `calc(var(--radius) - 4px)` goes negative. Clamp the aliases:

```css
@theme inline {
  --radius-sm: max(0px, calc(var(--radius) - 4px));
  --radius-md: max(0px, calc(var(--radius) - 2px));
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

### 2.8 Density axis

Density changes control and row heights only — never font size, never radius, never color.

```css
:root,
[data-density='comfortable'] {
  --control-h-sm: 2rem;     /* 32 */
  --control-h:    2.25rem;  /* 36 */
  --control-h-lg: 2.5rem;   /* 40 */
  --row-h:        3rem;     /* 48 */
  --card-p:       1.5rem;   /* 24 */
}

[data-density='compact'] {
  --control-h-sm: 1.75rem;  /* 28 */
  --control-h:    2rem;     /* 32 */
  --control-h-lg: 2.25rem;  /* 36 */
  --row-h:        2.25rem;  /* 36 */
  --card-p:       1rem;     /* 16 */
}
```

Consume them in `cva` with arbitrary values instead of fixed `h-9`:

```ts
// Tailwind v4
size: { sm: 'h-(--control-h-sm) px-3 text-xs', default: 'h-(--control-h) px-4 text-sm' }

// Tailwind v3
size: { sm: 'h-[var(--control-h-sm)] px-3 text-xs', default: 'h-[var(--control-h)] px-4 text-sm' }
```

If you don't need density switching, skip this axis entirely and keep the literal heights from §6.
Half-adopting it (some components on variables, some on `h-9`) is worse than not adopting it.

### 2.9 Theme registry

One TypeScript file is the source of truth for the switcher UI. If a preset isn't here, it doesn't
exist as far as the app is concerned.

```ts
// lib/themes.ts
export const THEMES = [
  { id: 'default', label: 'Neutral', swatch: 'oklch(0.205 0 0)' },
  { id: 'ocean',   label: 'Ocean',   swatch: 'oklch(0.55 0.15 230)' },
] as const

export const RADII     = ['none', 'sm', 'md', 'lg'] as const
export const DENSITIES = ['comfortable', 'compact'] as const

export type ThemeId = (typeof THEMES)[number]['id']
export type Radius  = (typeof RADII)[number]
export type Density = (typeof DENSITIES)[number]

export const THEME_DEFAULTS = {
  theme: 'default' as ThemeId,
  radius: 'md' as Radius,
  density: 'comfortable' as Density,
}

export const STORAGE_KEY = 'ui-prefs'
```

Swatches are literal color values on purpose — a switcher has to render a color the user hasn't
selected yet, so it can't read it from `var()`.

### 2.10 Runtime switching

Mode stays with `next-themes` (or your existing provider). The other three axes are plain
attributes on `<html>` plus one localStorage entry.

```tsx
// components/theme-provider.tsx  ('use client')
const Ctx = createContext<...>(null!)

export function UIPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState(THEME_DEFAULTS)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
      setPrefs({ ...THEME_DEFAULTS, ...saved })
    } catch {}
  }, [])

  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme   = prefs.theme
    el.dataset.radius  = prefs.radius
    el.dataset.density = prefs.density
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  }, [prefs])

  return <Ctx.Provider value={{ prefs, setPrefs }}>{children}</Ctx.Provider>
}

export const useUIPrefs = () => useContext(Ctx)
```

**No-flash script.** Attributes must land before first paint or every reload flashes the default
theme. Render this synchronously in `<head>`, before any stylesheet-dependent content:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `(function(){try{
      var p=JSON.parse(localStorage.getItem('ui-prefs')||'{}'),d=document.documentElement;
      d.dataset.theme=p.theme||'default';
      d.dataset.radius=p.radius||'md';
      d.dataset.density=p.density||'comfortable';
    }catch(e){}})()`,
  }}
/>
```

For server-rendered per-user themes, read the preference from a cookie in the root layout and set
the attributes on `<html>` directly — then drop the inline script.

### 2.11 Scoped themes

Because everything is a CSS variable, a theme can apply to a subtree. Useful for tenant-branded
embeds, previews inside a theme editor, or a marketing section that inverts.

```html
<div data-theme="ocean" class="dark rounded-lg border bg-background p-6">
  <!-- fully themed island, unaffected by the page theme -->
</div>
```

This only works if components use tokens. Any hard-coded color in a child leaks the page theme in
and breaks the island — which is the practical reason rule #1 in §1 exists.

### 2.12 Adding a theme — checklist

- [ ] Both `[data-theme='x']` and `.dark[data-theme='x']` blocks exist.
- [ ] Only tokens from the §2.6 list are overridden.
- [ ] `--primary` vs `--primary-foreground` clears 4.5:1 in both modes.
- [ ] `--ring` is visible against `--background` **and** against `--card`.
- [ ] The five chart colors are distinguishable from each other and in grayscale.
- [ ] Added to `THEMES` in `lib/themes.ts` with a swatch.
- [ ] Spot-checked against `data-radius="none"` and `data-density="compact"`.
- [ ] Checked on: a form, a data table, a dialog, a chart, an empty state.

---

## 3. Radius

```css
--radius: 0.625rem; /* 10px default, overridden by data-radius — see §2.7 */
```

| Alias | Applies to |
|---|---|
| `rounded-sm` | badges, tags, checkbox, small chips |
| `rounded-md` | buttons, inputs, select triggers, menu items |
| `rounded-lg` | cards, popovers, dialogs, panels |
| `rounded-xl` | hero cards, feature tiles, media frames |
| `rounded-full` | avatars, pills, icon buttons, toggles |

Nested corners: child radius = parent radius − padding. A child never rounds more than its parent.

---

## 4. Typography

| Role | Size / leading | Weight | Tracking |
|---|---|---|---|
| Display (hero) | 3–4.5rem / 1.05 | 600 | `-0.02em` |
| H1 page title | 1.875rem / 1.2 | 600 | `-0.01em` |
| H2 section | 1.5rem / 1.3 | 600 | `-0.01em` |
| H3 card title | 1.125rem / 1.4 | 600 | normal |
| Body (app) | 0.875rem / 1.6 | 400 | normal |
| Body (marketing) | 1rem / 1.7 | 400 | normal |
| Secondary / help | 0.8125rem / 1.5 | 400 | `text-muted-foreground` |
| Micro (table meta, kbd) | 0.75rem / 1.4 | 500 | normal |

Sentence case for headings, labels, and buttons — no ALL-CAPS eyebrows. Prose caps at ~72ch.
App UI is 14px; 16px body belongs to marketing pages only. Numeric columns get `tabular-nums`.
One sans family plus a mono for code, keys, and IDs.

---

## 5. Spacing & layout

4px scale. `1=4 2=8 3=12 4=16 6=24 8=32 12=48 16=64 24=96`.

| Context | Value |
|---|---|
| Icon ↔ label inside a control | `gap-2` |
| Label ↔ its input | `gap-1.5` |
| Between form fields | `gap-4` |
| Card padding | `p-6` (compact `p-4`) |
| Grid gap | `gap-4` app · `gap-6` marketing |
| App page padding | `p-4 md:p-6` |
| Marketing section | `py-16 md:py-24` |

Containers: content `max-w-7xl`, prose `max-w-3xl`, auth/forms `max-w-md`.

App shell: sidebar 256px / 56px collapsed, header 56–64px sticky with
`border-b border-border bg-background/80 backdrop-blur`.

Breakpoints `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. Sidebar becomes a Sheet below `lg`;
tables become stacked cards or horizontal scroll below `md`.

---

## 6. Component variants to add

These are patches to files you already have. Everything else about your components stays as is.

### 6.1 `button.tsx`

Keep shadcn's existing variants. Sizes should be `sm h-8 px-3 text-xs` · `default h-9 px-4 text-sm`
· `lg h-10 px-6 text-sm` · `icon h-9 w-9`. Icons render at `size-4` with `gap-2`.

One primary button per view. Labels are verbs and stay consistent through the flow — the button
that says "Publish" produces a toast that says "Published". Loading keeps the button's width and
swaps the leading icon for a spinner.

### 6.2 `badge.tsx`

Replace the variant map with an appearance × color pair. Soft is the default for status cells,
solid for counters and emphasis.

```ts
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border font-medium whitespace-nowrap ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  {
    variants: {
      appearance: { solid: 'border-transparent', soft: 'border-transparent', outline: 'bg-transparent' },
      color: { default: '', success: '', warning: '', info: '', destructive: '' },
      size: { sm: 'h-5 px-1.5 text-[11px]', md: 'h-6 px-2 text-xs' },
    },
    compoundVariants: [
      { appearance: 'solid',   color: 'default',     class: 'bg-invert text-invert-foreground' },
      { appearance: 'solid',   color: 'success',     class: 'bg-success text-white' },
      { appearance: 'solid',   color: 'warning',     class: 'bg-warning text-white' },
      { appearance: 'solid',   color: 'info',        class: 'bg-info text-white' },
      { appearance: 'solid',   color: 'destructive', class: 'bg-destructive text-white' },

      { appearance: 'soft',    color: 'default',     class: 'bg-muted text-foreground' },
      { appearance: 'soft',    color: 'success',     class: 'bg-success/10 text-success-foreground' },
      { appearance: 'soft',    color: 'warning',     class: 'bg-warning/10 text-warning-foreground' },
      { appearance: 'soft',    color: 'info',        class: 'bg-info/10 text-info-foreground' },
      { appearance: 'soft',    color: 'destructive', class: 'bg-destructive/10 text-destructive-foreground' },

      { appearance: 'outline', color: 'default',     class: 'border-border text-foreground' },
      { appearance: 'outline', color: 'success',     class: 'border-success/30 text-success-foreground' },
      { appearance: 'outline', color: 'warning',     class: 'border-warning/30 text-warning-foreground' },
      { appearance: 'outline', color: 'info',        class: 'border-info/30 text-info-foreground' },
      { appearance: 'outline', color: 'destructive', class: 'border-destructive/30 text-destructive-foreground' },
    ],
    defaultVariants: { appearance: 'soft', color: 'default', size: 'md' },
  }
)
```

### 6.3 `alert.tsx`

Add the three missing states to shadcn's `default` / `destructive` pair:

```ts
variants: {
  variant: {
    default:     'bg-card text-card-foreground border-border',
    info:        'bg-info/5 border-info/20 text-foreground [&>svg]:text-info',
    success:     'bg-success/5 border-success/20 text-foreground [&>svg]:text-success',
    warning:     'bg-warning/5 border-warning/20 text-foreground [&>svg]:text-warning',
    destructive: 'bg-destructive/5 border-destructive/20 text-foreground [&>svg]:text-destructive',
  },
}
```

Structure: icon column, title (`font-medium`), description (`text-sm text-muted-foreground`),
optional action row.

### 6.4 Focus, invalid, disabled — apply uniformly

```
focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring
aria-invalid:border-destructive aria-invalid:ring-destructive/20
disabled:pointer-events-none disabled:opacity-50
```

---

## 7. Composition recipes

Built from components you already have — no new files needed.

**Card**

```
rounded-lg border border-border bg-card text-card-foreground shadow-xs
  Header   p-6 pb-4    title 1rem/600 · description text-sm text-muted-foreground
  Content  p-6 pt-0
  Footer   p-6 pt-4 border-t border-border · actions right-aligned
```

**Field stack** — Label → Control → Description → Error. The error replaces the description, renders
`text-xs text-destructive-foreground`, and sets `aria-invalid` on the control.

**Input** — `h-9 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground`.
Input groups share one border and split with `divide-x`.

**Table** — header `h-10 bg-muted/50 text-xs font-medium text-muted-foreground`, rows `h-12`
(compact `h-9`), `border-b border-border`, `hover:bg-muted/50`, selected `bg-accent`. Sticky header
on scroll. Numeric and action columns right-aligned. Row actions in a trailing icon button +
DropdownMenu. Skeleton rows while loading; never a blank grid.

**Empty state** — centered: icon tile (`size-10 rounded-lg bg-muted grid place-items-center`),
title `text-sm font-medium`, one line of description, one primary action. Say what to do next, not
"No data found".

**Overlays** — Dialog `max-w-lg rounded-lg p-6`; Sheet 400px full-height (`sm:max-w-sm`); Drawer
bottom-anchored on mobile. Radix handles focus trap and `Esc`; make sure every one has a real
`DialogTitle` (use `sr-only` if visually hidden) or screen readers get nothing.

**Elevation**

| Level | Where | Style |
|---|---|---|
| 0 | Page, inline card | `border border-border` |
| 1 | Raised card, sticky header | `shadow-xs` |
| 2 | Dropdown, popover, tooltip | `shadow-md` + border |
| 3 | Dialog, sheet, command | `shadow-lg` + `bg-black/50` overlay |

---

## 8. Motion

```
fast  120ms — hover, color, background
base  180ms — dropdown, tooltip, popover
slow  250ms — dialog, sheet, drawer, accordion
ease  cubic-bezier(0.16, 1, 0.3, 1)
```

Overlays fade with a 4px slide from the trigger side; dialogs add `scale(0.98) → 1`. Accordions
animate height only. Drag: lifted ghost at `shadow-lg`, drop target `border-dashed border-border`.
Skeletons pulse, spinners rotate 800ms linear. No scroll-triggered section reveals.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Dark mode & RTL

Class strategy (`.dark` on `<html>`), `suppressHydrationWarning` on the html element. In dark mode
cards sit *above* the page (`--card` lighter than `--background`) and borders go translucent white
(`oklch(1 0 0 / 10%)`). Never invert with CSS filters. Check every state color in both modes.

For RTL: `dir="rtl"` on the root, logical utilities throughout, mirror chevrons and arrows, never
mirror logos, clocks, or media controls.

---

## 10. Accessibility floor

- 4.5:1 for body text, 3:1 for large text and UI boundaries.
- Everything interactive is keyboard-reachable with a visible focus ring.
- Icon-only controls carry `aria-label`; decorative icons carry `aria-hidden="true"`.
- Live regions for toasts and async results; `aria-busy` while loading.
- Hit targets ≥ 24px, ≥ 44px on touch.

---

## 11. Rules for contributors and coding agents

1. Check `components/ui/` before building anything. Extend what's there.
2. Never introduce a hex value or a Tailwind palette class in app code. Tokens only.
3. Don't fork a primitive to restyle it — compose it, or add a variant via `cva` and `cn()`.
4. Match the surrounding density: `sm` inside data surfaces, `md` elsewhere.
5. A theme preset overrides tokens from the §2.6 list and nothing else. New token → base, for all
   themes, or not at all.
6. Test new UI against a non-default theme before merging. If it only looks right on `default`,
   there's a hard-coded color in it.
7. Every new surface ships default, loading, empty, and error states.
8. Keep `"use client"` at the leaf; fetch on the server.
9. Copy is design content: active voice, sentence case, plain verbs. Errors say what happened and
   how to fix it. Empty screens invite an action.

---

## 12. Quick reference

```
Radius     0.625rem → sm / md / lg / xl / full
Body       14px app · 16px marketing
Control    h-8 sm · h-9 default · h-10 lg
Icon       16px in controls · 20px standalone
Card       rounded-lg border p-6 shadow-xs
Focus      ring-[3px] ring-ring/50
Gap        16px app · 24px marketing
Section    py-16 md:py-24
Container  max-w-7xl
Sidebar    256px / 56px collapsed
Header     56–64px sticky, blurred
```

**Never**: `bg-white` · `text-gray-500` · `#111` · `ml-`/`mr-` in RTL layouts · color-only status ·
motion without a reduced-motion guard · a table with no empty state.
