# YouTube button style — reference spec

Extracted 2026-11-16 from youtube.com (home + watch page, dark theme, signed out) by reading
the live computed styles and the `ytSpecButtonShapeNext*` / `ytChipShape*` CSS rules.
Dark-theme colours are **measured**. Light-theme colours are YouTube's usual light values from
memory and were **not measured** — verify before relying on them.

## 1. Anatomy

| Property | Value |
|---|---|
| Font | `Roboto, Arial, sans-serif`, weight **500**, no text-transform |
| Shape | Full pill — `border-radius = height / 2` |
| Layout | `inline-flex`, centred, `white-space: nowrap` |
| Border | none by default; Outline = `1px solid`; Focused = `2px solid` |
| Icon | `fill: currentColor`, leading / trailing / both / icon-only |
| Cursor | pointer, no tap highlight, outline removed (focus shown by the 2px border) |

## 2. Sizes

| Size | Height | Font | Padding-x | Radius | Icon | Icon gap | Icon-only width |
|---|---|---|---|---|---|---|---|
| XS | 24px | 12px | 8px | 12px | 16px | 2px | 24px |
| S | 32px | 12px | 12px | 16px | 16px | 4px | 32px |
| **M (default)** | **40px** | **14px** | **16px** | **20px** | **24px** | **6px** | **40px** |
| L | 48px | 18px | 24px | 24px | 24px | 8px | 48px |
| XL | — | — | 32px | — | — | — | — |

- Outline variant: padding-x is 1px less (border eats it), e.g. M = `0 15px`.
- Focused: padding-x is 2px less (2px border), e.g. M = `0 14px`.
- Line-height equals height (text vertically centred by line box).

## 3. Variants × colour (dark theme, measured)

Two colour families: **Mono** (neutral, used almost everywhere) and **CallToAction** (blue,
used for Sign in and primary links).

| Variant | Background | Text | Border | Hover / pressed bg |
|---|---|---|---|---|
| Mono · Filled (Subscribe) | `#f1f1f1` | `#0f0f0f` | — | `#d9d9d9` |
| Mono · Tonal (Like, Share, Download) | `rgba(255,255,255,.10)` | `#f1f1f1` | — | `rgba(255,255,255,.20)` |
| Mono · Outline | transparent | `#f1f1f1` | `1px rgba(255,255,255,.20)` | `rgba(255,255,255,.20)`, border → transparent |
| Mono · Text (More ⋯, mic) | transparent | `#f1f1f1` | — | `rgba(255,255,255,.20)` |
| CTA · Filled | `#3ea6ff` | `#0f0f0f` | — | `#65b8ff` |
| CTA · Tonal | `#263850` | `#3ea6ff` | — | `#515561` |
| CTA · Outline (Sign in) | transparent | `#3ea6ff` | `1px rgba(255,255,255,.20)` | `#263850`, border → transparent |
| CTA · Text | transparent | `#3ea6ff` | — | `#263850` |
| Disabled (Filled/Tonal) | `rgba(255,255,255,.10)` | `#717171` | — | none |
| Disabled (Outline/Text) | transparent | `#717171` | Outline keeps `rgba(255,255,255,.20)` | none |

Hover and pressed (`:active`) use the **same** colour; hover only applies on devices with
`(hover: hover)`, touch devices get it on press only.

### Light theme (reference, not measured)

| Role | Value |
|---|---|
| Mono Filled | bg `#0f0f0f`, text `#fff`, hover `#272727` |
| Mono Tonal | bg `rgba(0,0,0,.05)`, text `#0f0f0f`, hover `rgba(0,0,0,.10)` |
| Outline border | `rgba(0,0,0,.10)` |
| CTA text | `#065fd4`, CTA tonal bg `#def1ff` |
| Disabled text | `#909090` |

## 4. Focus

Keyboard focus swaps to a **2px solid border in the text colour** (`#f1f1f1` mono, `#3ea6ff`
CTA) with transparent background, and padding shrinks by 2px so the width does not change.

## 5. Segmented group (Like | Dislike)

- Two Tonal buttons side by side, no gap.
- Start: `border-radius: 20px 0 0 20px`; End: `0 20px 20px 0`.
- Divider: `::after` on the start button — `1px` wide, `24px` tall (M), `top: 8px`, colour
  `rgba(255,255,255,.20)`.
- Icon-only end segment is wider than a normal icon button: M = 56px (XS 32, S 44, L 72).

## 6. Chips (filter bar)

| Property | Value |
|---|---|
| Height | 32px |
| Radius | **8px** (not a pill) |
| Font | Roboto 14px / 20px, weight 500 |
| Inactive | bg `rgba(255,255,255,.10)`, text `#f1f1f1` |
| Active | bg `#f1f1f1`, text `#0f0f0f` (inverted) |
| Inactive (redesign) | transparent, text `#aaa`, `1px rgba(255,255,255,.20)` border |

## 7. Player-overlay buttons (separate system)

Inside the video player (`.ytp-button`): 40px tall, 48px wide, transparent, icon colour
`#eee`, no radius; the centre play button is a 40px circle on `rgba(0,0,0,.3)`.

## 8. Quick CSS (M, Mono)

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  height: 40px; padding: 0 16px; border-radius: 20px; border: 0;
  font: 500 14px/40px Roboto, Arial, sans-serif; white-space: nowrap; cursor: pointer;
}
.btn > svg { width: 24px; height: 24px; fill: currentColor; }
.btn--icon { width: 40px; padding: 0; }

.btn--filled  { background: #f1f1f1; color: #0f0f0f; }
.btn--filled:hover  { background: #d9d9d9; }
.btn--tonal   { background: rgba(255,255,255,.1); color: #f1f1f1; }
.btn--tonal:hover   { background: rgba(255,255,255,.2); }
.btn--outline { background: transparent; color: #f1f1f1; border: 1px solid rgba(255,255,255,.2); padding: 0 15px; }
.btn--outline:hover { background: rgba(255,255,255,.2); border-color: transparent; }
.btn--text    { background: transparent; color: #f1f1f1; }
.btn--text:hover    { background: rgba(255,255,255,.2); }
.btn--cta.btn--outline { color: #3ea6ff; }
.btn--cta.btn--outline:hover { background: #263850; }

.btn:focus-visible { border: 2px solid currentColor; padding: 0 14px; background: transparent; }
.btn:disabled { color: #717171; background: rgba(255,255,255,.1); cursor: default; }
```
