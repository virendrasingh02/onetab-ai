# OneTab AI — Brand Design System

Derived from the onetab.ai logo. Structure borrows from Slack's model (a dark, confident
**navigation rail** + a clean white **work surface** + one bright **action colour**), but the
identity is our own: deep ink navy, a four-colour "tab" spectrum, and soft rounded geometry.

> Relationship to `DESIGN.md`: that file is the component/token *spec* (sizing, states, theming axes).
> This file is the *brand layer*: colour, type, shape, motion and voice. Values here are meant to
> be plugged into the semantic tokens in `libs/shared/design-system/src/styles/theme.css`.
> The current theme.css still carries the old marketer.com green palette — migrating it to this
> file is a separate, explicit step.

---

## 1. Logo analysis

| Part | What it is | Design meaning |
|---|---|---|
| Icon | Rounded square split into 4 quadrants: **mint, cyan, yellow, pink**, with a navy "tab" ring and white core | "Many tabs → one place". Four colours = four workspaces/apps converging |
| Wordmark | `onetab` in **ink navy**, bold geometric sans, lower-case | Confident, modern, approachable |
| `.ai` | Same face, **neutral grey** `#888888`, `™` superscript | The AI is a quiet layer, not the headline |

Sampled from the logo file: navy `#001760`, mint `#37EFB6`, cyan `#36CFF2`, yellow `#E2E220`,
pink `#F75CB5`, grey `#888888`.

### Logo usage
- Clear space = height of the icon's inner white core on all sides. Min icon size 20 px; min lockup width 96 px.
- On light: full-colour lockup. On navy/dark: icon unchanged, `onetab` in white, `.ai` in `#8F9BC7`.
- Never recolour the quadrants, rotate, add shadows/gradients, or put the icon on a yellow or pink background.
- Favicon / app icon: icon only, on white rounded tile (dark mode: on `#0A1236`).

---

## 2. Colour

### 2.1 Brand core

| Token | Hex | Role |
|---|---|---|
| `ink` | `#001760` | Primary text, logo, strong UI |
| `ink-deep` | `#000F3F` | Navigation rail (Slack-aubergine equivalent) |
| `mint` | `#37EFB6` | **Primary action fill**, success glow, selection |
| `cyan` | `#36CFF2` | Info, links on dark, focus accents |
| `sun` | `#E2E220` | Highlights, "new", warnings (fill only) |
| `bloom` | `#F75CB5` | Mentions, AI sparkle, notifications |

**Rule of thumb:** navy does the work, mint says "do this", cyan/sun/bloom are accents used in
small doses (badges, dots, illustrations). Never use more than two accent colours in one view.

### 2.2 Neutral ramp (navy-tinted, never pure grey)

| Step | Hex | Use |
|---|---|---|
| 0 | `#FFFFFF` | Cards, composer, popovers |
| 50 | `#F7F8FC` | App canvas |
| 100 | `#EFF0F5` | Hover rows, subtle fills |
| 200 | `#E1E4EF` | Borders |
| 300 | `#C9CFE3` | Strong borders, disabled |
| 500 | `#5F6B94` | Muted text (≥4.5:1 on white) |
| 700 | `#2B3568` | Secondary text |
| 900 | `#001760` | Primary text |

### 2.3 Semantic tokens — Light

```css
:root {
  --background:            #F7F8FC;
  --foreground:            #001760;
  --card:                  #FFFFFF;
  --card-foreground:       #001760;
  --popover:               #FFFFFF;
  --popover-foreground:    #001760;

  --primary:               #37EFB6;   /* fill — takes NAVY text, never white */
  --primary-foreground:    #001760;   /* 10.98:1 */
  --primary-hover:         #22DCA3;
  --secondary:             #EFF0F5;
  --secondary-foreground:  #001760;
  --muted:                 #EFF0F5;
  --muted-foreground:      #5F6B94;   /* ≥4.5:1 on white */
  --accent:                #E6F0FF;   /* selected row / hover tint */
  --accent-foreground:     #001760;

  --link:                  #2A44B8;   /* 8.0:1 on white */
  --border:                #E1E4EF;
  --input:                 #C9CFE3;
  --ring:                  #2A44B8;   /* focus ring, 2px + 2px offset */

  --destructive:           #D6246E;
  --destructive-foreground:#FFFFFF;
  --success:               #00794F;   /* 5.46:1 text on white */
  --warning:               #8A6A00;   /* 5.07:1 text; use --sun for fills */
  --info:                  #2A44B8;
  --mention:               #F75CB5;   /* fill; text on it is navy (5.5:1) */

  /* Navigation rail (Slack-style) */
  --sidebar:               #000F3F;
  --sidebar-foreground:    #B8C2E6;   /* 10.4:1 */
  --sidebar-muted:         #8F9BC7;
  --sidebar-hover:         #0B1D5C;
  --sidebar-active:        #37EFB6;   /* active row fill */
  --sidebar-active-foreground: #001760;
  --sidebar-badge:         #F75CB5;
  --sidebar-border:        #16276E;
}
```

### 2.4 Semantic tokens — Dark

```css
.dark {
  --background:            #0A1236;
  --foreground:            #E8ECFF;   /* 15.5:1 */
  --card:                  #101A47;
  --card-foreground:       #E8ECFF;
  --popover:               #101A47;
  --popover-foreground:    #E8ECFF;

  --primary:               #37EFB6;   /* same mint; 12.3:1 on bg */
  --primary-foreground:    #001760;
  --primary-hover:         #5CF5C6;
  --secondary:             #16215A;
  --secondary-foreground:  #E8ECFF;
  --muted:                 #16215A;
  --muted-foreground:      #8F9BC7;   /* 6.7:1 */
  --accent:                #1B2870;
  --accent-foreground:     #E8ECFF;

  --link:                  #7FA2FF;   /* 7.4:1 */
  --border:                #1E2B6E;
  --input:                 #2A3A85;
  --ring:                  #36CFF2;

  --destructive:           #FF6B9D;
  --destructive-foreground:#001760;
  --success:               #37EFB6;
  --warning:               #E2E220;
  --info:                  #36CFF2;
  --mention:               #F75CB5;

  --sidebar:               #060C2B;
  --sidebar-foreground:    #B8C2E6;
  --sidebar-muted:         #8F9BC7;
  --sidebar-hover:         #101A47;
  --sidebar-active:        #37EFB6;
  --sidebar-active-foreground: #001760;
  --sidebar-badge:         #F75CB5;
  --sidebar-border:        #16215A;
}
```

Contrast figures were computed (WCAG 2.x) for the pairs marked above. Re-verify any new pair before use.

### 2.5 The "tab spectrum"
Four-stop signature gradient for hero art, empty states, AI-thinking shimmer and loading bars **only**
(never buttons or text):

```css
--spectrum: conic-gradient(from 45deg, #37EFB6, #36CFF2, #F75CB5, #E2E220, #37EFB6);
--spectrum-soft: linear-gradient(135deg, #37EFB633, #36CFF233, #F75CB533);
```

### 2.6 Channel / avatar palette (deterministic from user id)
`#36CFF2 · #37EFB6 · #F75CB5 · #E2E220 · #7FA2FF · #FF9B54 · #B18CFF · #5DD3C4` — always
navy initials (`#001760`) on these fills.

### 2.7 Data-viz order
1 `#2A44B8` → 2 `#36CFF2` → 3 `#37EFB6` → 4 `#F75CB5` → 5 `#E2E220` → 6 `#B18CFF`.
Add direct labels or patterns; don't rely on colour alone.

---

## 3. Typography

| Role | Face | Notes |
|---|---|---|
| UI + headings | **Inter** (variable, already loaded) | Tight tracking on display sizes |
| Optional display | **Plus Jakarta Sans** 700/800 | Marketing headlines only — closest free match to the logo's geometric bold |
| Code | **JetBrains Mono** (already loaded) | |

| Style | Size / line | Weight | Tracking |
|---|---|---|---|
| Display | 48 / 52 | 800 | −0.03em |
| H1 | 32 / 38 | 700 | −0.02em |
| H2 | 24 / 30 | 700 | −0.015em |
| H3 | 18 / 24 | 600 | −0.01em |
| Body (chat) | 15 / 22 | 400 | 0 |
| UI | 14 / 20 | 500 | 0 |
| Small | 13 / 18 | 400 | 0 |
| Caption / meta | 12 / 16 | 500 | 0.01em |
| Overline | 11 / 14 | 700 | 0.08em, uppercase |

Chat messages use 15 px for legibility at density `md`; sidebar rows 14 px; timestamps 12 px muted.
Brand voice in headings: lower-case wordmark `onetab`, but sentence-case everywhere else.

---

## 4. Shape, space, elevation

- **Radius** (echoes the logo's rounded tile): `xs 4 · sm 6 · md 10 · lg 14 · xl 20 · full 999`.
  Buttons/inputs `md`, cards `lg`, modals `xl`, avatars `md` (rounded-square, Slack-style — **not** circles, except presence/AI).
- **Spacing:** 4 px base: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.
- **Borders carry structure; shadows carry elevation** (see `DESIGN.md` §1).

| Level | Shadow (light) | Use |
|---|---|---|
| 0 | none, 1px `--border` | Cards, panels |
| 1 | `0 1px 2px rgb(0 23 96 / .06)` | Hovered cards |
| 2 | `0 8px 24px rgb(0 23 96 / .12)` | Popovers, menus |
| 3 | `0 20px 48px rgb(0 23 96 / .20)` | Modals |

Shadows are navy-tinted, never black. In dark mode use a 1px `--border` + slightly lighter surface instead.

---

## 5. Layout (Slack-inspired, restyled)

```
┌──┬─────────────┬───────────────────────────────┬──────────┐
│W │  Sidebar    │  Channel header + tabs        │  Thread  │
│S │  (ink-deep) │  ───────────────────────────  │  / Info  │
│  │  Channels   │  Message list (white canvas)  │  panel   │
│  │  DMs        │  ───────────────────────────  │  (white) │
│  │  Apps       │  Composer (card, radius lg)   │          │
└──┴─────────────┴───────────────────────────────┴──────────┘
 64   260 (resize 220–360)         fluid               380
```

- **Workspace rail (64 px):** `--sidebar` darkest shade, workspace tiles are rounded-squares (radius `md`); active tile gets a 3 px mint bar on its start edge.
- **Sidebar (260 px):** navy; section headers overline style; active row = **mint fill with navy text**; unread = white bold; mention badge = pink pill with navy count.
- **Work surface:** white; the sidebar/surface contrast is the main brand moment — keep it.
- **Top bar (48 px):** search field centred, `--sidebar-hover` fill on the navy variant.
- Mobile: rail collapses into `MobileBottomNav`; thread panel becomes a full-screen sheet.

---

## 6. Components

**Buttons** (height 36 default / 28 sm / 44 lg, radius `md`, weight 600)
- *Primary*: mint fill, navy text, hover `--primary-hover`, active scale 0.98. **Never white text on mint.**
- *Secondary*: white fill, 1px `--input` border, navy text.
- *Ghost*: transparent, hover `--accent`.
- *Destructive*: `--destructive` fill (confirm dialogs required — see confirm-dialog system).
- *AI action*: navy fill, white text, a 14 px spectrum sparkle icon at the start.

**Inputs:** white, 1px `--input`, radius `md`, focus = 2px `--ring` + offset. Label above, helper below, error text in `--destructive` with icon (never colour alone).

**Badges / pills:** radius `full`, 12 px, 600. *New* = sun fill + navy text; *Mention* = bloom + navy; *Info* = `--accent` + `--link`; *Success* = mint at 20% + `--success` text.

**Message row:** 36 px rounded-square avatar, name 15/600, time 12 muted, body 15/22. Hover: `--muted` background + floating action bar (card, shadow 1, radius `md`). Mentions of the current user: row tinted `#F75CB514` with 3 px bloom start border.

**Composer:** card, 1px border, radius `lg`; toolbar row on top (format) and bottom (attach, emoji, voice, schedule); Send = mint button, disabled at 40% opacity when empty.

**Presence dot:** online = mint, away = sun, DND = bloom, offline = hollow `--muted-foreground`. One indicator only per avatar.

**AI surfaces:** AI messages/coworkers get a 1px spectrum-soft border and the sparkle glyph; "thinking" = spectrum shimmer on a 2 px top bar. AI is visually distinct but never louder than people.

**Tabs:** underline style; active = navy text + 2 px mint underline. **Tooltips:** navy fill, white text, radius `sm`, 12 px.

**Empty states:** 96 px illustration built from the four quadrant colours at 100 % + navy outline, one-line headline, one primary action.

---

## 7. Iconography & illustration
- Lucide-style, 1.75 px stroke, 16 / 20 / 24 px, `currentColor`, rounded caps/joins.
- Illustrations: flat shapes from the quadrant palette, rounded corners ≥ 8 px, navy 2 px outlines, no gradients except `--spectrum-soft` backdrops.
- Emoji reactions render native/emojibase; reaction pills: radius `full`, selected = `--accent` fill + 1px `--link` border.

---

## 8. Motion
| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Everything |
| `--dur-fast` | 120 ms | Hover, press |
| `--dur-base` | 200 ms | Menus, tabs, toasts |
| `--dur-slow` | 320 ms | Panels, modals, sheets |

Motion answers an action; nothing loops except AI-thinking and loading. Honour `prefers-reduced-motion` (swap to opacity fades, stop the shimmer).

---

## 9. Accessibility
- Body text ≥ 4.5:1, large text/UI borders ≥ 3:1 in both themes.
- Mint, cyan, sun and bloom are **fills only** on light backgrounds; text on them is navy.
- Visible focus ring on every interactive element (`--ring`, 2px, offset 2px).
- Touch targets ≥ 44 px on coarse pointers; status is never colour-only.

---

## 10. Voice
Calm, direct, a little warm. Verbs first ("Add a teammate"), no exclamation marks in errors, no jargon.
Name the thing, not the system: "Couldn't send — you're offline. We'll retry." Tagline candidates:
*"All your tabs. One place."* · *"One tab for everything your team does."*

---

## 11. Implementation checklist
1. Map §2.3/§2.4 into `libs/shared/design-system/src/styles/theme.css` (replace the green palette; keep token *names*).
2. Add `--sidebar-*` active/badge tokens and update the rail + sidebar components to the mint-active pattern.
3. Swap radius tokens to §4; add navy-tinted shadow tokens.
4. Update `normalizeAvatarSeed` palette to §2.6.
5. Replace favicon/app icon with the icon-only tile (§1).
6. Re-run contrast checks and a visual pass in light, dark and mobile.
