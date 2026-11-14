# DESIGN.md

Design reference for Teanote. Two surfaces, two design systems, one brand.

- **App** (`client/`) — hand-rolled CSS with custom-property themes, runtime theme swap, mobile-first dock nav.
- **Marketing site** (`site/`) — Tailwind 4 + custom CSS, layered gradient backgrounds, 3D tilt cards, scroll-aware header.

Same brand colors (`#bdb695` warm tan, `#898565` deeper olive), different machinery. Don't try to unify them — they intentionally use different stacks.

---

## Brand

| Token | Value | Use |
|---|---|---|
| `--brand-primary` | `#bdb695` | warm tan — headers, accents, badge borders |
| `--brand-primary-light` | `#bdb6958e` | item backgrounds (cards, list rows) |
| `--brand-secondary` | `#898565` | sidebar background, secondary CTAs |
| `--brand-secondary-light` | `#8985658e` | action button background |
| `--surface-color` | `#f9f7f3` | section/card surface (warm off-white) |
| `--bg-color` | `#fff` | app background |
| `--text-color` | `rgba(0,0,0,0.88)` | body text |
| `--text-color-light` | `rgba(255,255,255,0.88)` | text on dark backgrounds |
| `--success` / `--danger` / `--info` | `#24be33` / `#ed1244` / `#3239ff` | semantic |
| `--shadow-container` | `-2px 4px 16px #20212128` | the one shadow, used everywhere |

**Mood:** calm, earthy, matcha-tea palette. Warm beige > cool gray. Round corners. Soft shadows. Emoji are part of the visual language (🍵 🍃 ⏱️ 📔 ⚙️ 👨🏻‍🔧 ⏳ ✅) — they live in nav labels and toasts. Don't strip them.

---

## App (`client/`)

### Typography

- Font: **Inter** from Google Fonts (variable, italic + roman, 100–900). System-ui fallback.
- Base: `16px` / `font-weight: 400`.
- Headings: section `h2` is `18px`, page `h1` uses default browser size (no global override). Login/signup `h2` is `24px` inside a brand-tinted pill.
- Smaller copy: `font-size: 13px` (subtitle, badges, links, captions). This is the canonical "small" size.

### Spacing rhythm

These three numbers are the system. Pick one before inventing a new value.

- **`10px`** — the canonical gap between siblings (`gap: 10px` on flex/grid containers, `margin-top: 10px` for new sections).
- **`16px`** — inner padding of cards, buttons (horizontal), modals, tea-image wrap, button-pill horizontal padding.
- **`8px`** — vertical button padding, small icon gaps, list-item internal padding (sometimes), `border-radius`.

Common compound: `padding: 8px 16px` for buttons/inputs/selects, `padding: 16px` for cards.

### Radius

- **`8px`** for everything — buttons, inputs, cards, tags, modals, item rows.
- **`50%`** for the brew timer disc.
- Mobile-only: `16px` top corners on the `.more-links` slide-up panel.

### Layout shell

```
┌──────────────────────────────────────────────┐
│ .main-header  (sticky top, z-1000, 55px)    │
├──────────┬───────────────────────────────────┤
│ .sidebar │ main                              │
│ 210px    │ margin-left: 210px                │
│ fixed    │ width: calc(100% - 210px)         │
│ top:55   │                                   │
│          │ .page-wrap (padding: 10px 24px)   │
│          │   .page-header                    │
│          │   .{page}-content (flex-wrap)     │
│          │     section (flex: 1 1 330px)     │
└──────────┴───────────────────────────────────┘
```

`.app` is `100dvh` flex column. `.layout` is the row that contains sidebar + main.

### Responsive

Single breakpoint: **`max-width: 860px`**. Below it:

- Sidebar **rotates from vertical-left to horizontal-bottom dock** (`flex-direction: row`, `bottom: 0`, full width).
- Main margin-left is reset to 0.
- `.hide-mobile` hides desktop-only items (Home, Settings, Account links go behind a `MobileMoreLinks` drawer that slides up from the dock).
- `.hide-desktop` is its inverse — hidden on desktop, shown on mobile.
- Filter bars become sticky with `backdrop-filter: blur(16px)` for a frosted-glass effect over scrolled content.
- Tea/journal items flip to `column-reverse` (image/preview on top, actions below).
- Action button rows become `sticky bottom: 90px` so they hover above the dock.

There is no tablet breakpoint and no separate mobile component tree — same JSX, different CSS.

### Component tokens

The `.btn` class is the base — `flex`, `align-items: center`, `gap: 5px`, `padding: 8px 16px`, `border-radius: 8px`, `cursor: pointer`, `transition: all .15s ease-in-out`, `&:active { scale: 0.95 }`. Variants:

| Class | Color | Purpose |
|---|---|---|
| `.btn-action` | brand-secondary-light | header CTAs, generic actions |
| `.btn-sidebar` | brand-primary-light | sidebar links |
| `.btn-quick` | success-color | positive primary CTA |
| `.btn-danger` | danger-color | destructive |
| `.btn-info` | info-color | info CTAs |
| `.btn-dark` | dark-color | strong neutral |
| `.btn-simple` | transparent + bold text | inline text-button |
| `.btn-sync` | smaller pad (`4px 8px`) | nav sync indicator |

`.disabled` state: `filter: blur(1px) grayscale(100%); opacity: 0.5; pointer-events: none;` — a single token to disable any element. Use it instead of an `aria-disabled` styling.

### Forms

- Inputs/textareas/selects: `padding: 8px 16px`, `border-radius: 8px`, `border: 1px solid var(--brand-primary)`, transparent native UI (`appearance: none`).
- Textarea minimum: `min-height: 150px`.
- Select minimum: `min-width: 180px`; custom `▼` arrow rendered as a CSS triangle inside `.select-wrap > .arr-down`.
- Form rows are stacked: `display: flex; flex-direction: column; gap: 10px`, with `input/select/textarea { width: 100% }`.
- Placeholders: `var(--placeholder-color)` (light gray, themed).
- Required-field marker: red asterisk via `.req`.
- Labels above inputs: `.basic-label` (`13px`, `margin-left: 8px`).

### Cards / sections

Pages are flex-wrap grids of `<section>` cards. The shared pattern:

```css
.dashboard-content section, .brew-content section, ... {
  background: var(--surface-color);
  padding: 16px;
  border-radius: 8px;
  flex: 1 1 330px;     /* always 330px min — the canonical card width */
}
```

`flex: 1 1 330px` means "grow to fill, shrink if needed, but prefer ~330px". Don't change this number per-card — it's what makes the auto-grid responsive without media queries.

### Lists & items

`.tea-list / .journal-list / .brew-list` are `flex-direction: column; gap: 10px`. Items inside use `.tea-item / .journal-item / .brew-item`:

- background `var(--brand-primary-light)`
- `padding: 12px`, `border-radius: 8px`
- `display: flex; justify-content: space-between; align-items: start; gap: 10px`

Action button rows (`.tea-actions` etc.) are `position: sticky; bottom: 16px` (desktop) / `90px` (mobile) — they stay visible while scrolling long lists.

### Tea-type tags

`.tea-tag` is a pill (`padding: 2px 8px; border-radius: 8px; font-size: 13px; text-transform: capitalize`). Variants are color-paired by tea type:

| Variant | bg | text |
|---|---|---|
| `green` | `#dbffd2` | `#27622a` |
| `oolong` | `#ffeccc` | `#7c5c2e` |
| `red` | `#ffd6db` | `#a52d44` |
| `white` | `#fff` | `#474747` |
| `yellow` | `#fffaa6` | `#907e00` |
| `puerh` | `#e7dbbd` | `#6b4b26` |
| `purple` | `#f1e4ff` | `#673988` |
| `generic` / `undefined` / `any` | `#ccc` | `#474747` |

These use `!important` to survive theme swaps — the tag colors are intentionally theme-independent (a green tea should look like green tea in night mode too). Don't tokenize them.

### The brew timer

`.tea-timer` is a 120×120 circle with an animated CSS "liquid fill":

- `.tea-liquid` height is set via `--fill` custom property updated from JS as the timer progresses.
- Gradient from `--tea-color` to its 70% transparent version.
- A blurred pseudo-element on top creates a wavy meniscus, animated with `@keyframes wave` (4s ease-in-out infinite, ±10px translate).
- The countdown number sits on top with `mix-blend-mode: difference` so it reads against both empty and filled states.

This is the signature whimsy of the app. If you touch it, keep the wave + difference-blend.

### Theming

Themes live in `client/public/themes/*.css` and only redefine `:root` custom properties. A theme swap re-points the `<link id="theme-css">` href — no rebuild, no flicker.

Current themes:

| Theme | Vibe |
|---|---|
| `default` | warm tan + warm off-white, the canonical brand |
| `cozy` | soft sage + parchment, warmer success/danger tones |
| `night` | dark mode — deep greens, light text, inverted shadow (white at 25%) |
| `sakura` | pink/magenta — `#ff92d7` primary, plum text |

**To add a theme:** drop a new `.css` into `client/public/themes/` defining every `:root` token from `default.css`, then add it to the `themeMap` in `client/src/AppInitializer.tsx`. (See the CLAUDE.md note about the duplicate theme-swap path in `ThemeManager.tsx`.)

**Rule:** never hardcode a color in a component unless it's intentionally theme-independent (like the tea-type tags). Every color should be a `var(--…)` so themes work.

### Auth pages

`.login` and `.signup` are full-viewport (`100dvh`) with a diagonal gradient `linear-gradient(235deg, var(--brand-primary) 0%, white 100%)`. The form is centered with a giant emoji as logo (`128px`). Submit button is centered (`align-self: center`), with auxiliary links (`.forgot-pwd`, `.new-account`) below in `13px` bold.

### Loading / sync feedback

- `Loader.tsx` wraps `react-spinners`; defaults to small inline (`size={16}`, `inline={true}`).
- Sync state UI lives in `DesktopSidebar` footer: spinner + "syncing…", check + "just synced", or quiet "synced at HH:MM:SS".
- `SyncOnReconnect` shows a tiny inline message on connection loss/regain (`❌ connection lost` / `🌐 connection back`) and auto-hides after 2s.
- Toasts: `react-hot-toast` (default `<Toaster/>` in `App.tsx`) for user-initiated success/error.

---

## Marketing site (`site/`)

Different aesthetic — more polished, more motion, designed to convert.

### Stack

- Tailwind 4 via `@tailwindcss/vite` (no separate config file — `@import "tailwindcss"` in `src/styles/global.css`).
- `@tailwindcss/typography` plugin for blog prose.
- Astro 5 with content collections for the blog.

### Background

The body has a layered radial-gradient + linear-gradient on `background-attachment: fixed`:

```css
body {
  background:
    radial-gradient(44rem 26rem at 18% 36%, rgba(74, 52, 38, 0.27)…),
    radial-gradient(42rem 24rem at 82% 34%, rgba(36, 82, 56, 0.24)…),
    radial-gradient(34rem 22rem at 50% 42%, rgba(189, 182, 149, 0.29)…),
    /* + 2 more radials */
    linear-gradient(to bottom, #fff 0%, #f6f3ea 30%, #efe9db 40%, #f6f3ea 52%, #fff 100%);
}
```

Five radial blobs (warm browns, deep greens, brand tan) layered over a soft horizontal cream band. Pages float on this — most sections use `bg-white` cards inside `max-w-6xl` containers.

### Buttons (`Button.astro`)

Three variants:

- **`primary`** — green gradient (`from-green-900 to-green-500`), big green-tinted shadow that intensifies on hover (`0_10px_40px → 0_10px_70px rgba(34,197,94,0.65)`), `hover:-translate-y-0.5 hover:scale-[1.02]`.
- **`dark`** — zinc-to-olive gradient (`from-zinc-950 to-[#898565]`).
- **`outline`** — white with zinc border, brand-secondary hover.

All variants include a **liquid-sheen overlay** — an absolutely-positioned radial-gradient `<span>` that fades in and slides on hover, plus a `ring-1 ring-white/15` inner glow. Don't strip these spans — they're what makes the buttons feel premium.

### Header

`Header.astro` is sticky with scroll-aware behavior — `onScroll` JS toggles `backdrop-blur-md bg-white/70 header-elevated` when scrolled past 8px, and shrinks vertical padding from `md:py-5` to `md:py-2`. Mobile menu is a slide-down panel with `backdrop-blur`.

### 3D tilt cards

`.tilt-card` (defined in `global.css`) uses `transform-style: preserve-3d` and a small JS handler in `Layout.astro` that reads mouse position and applies `perspective(900px) rotateX/rotateY` up to ±8°. Hover adds a soft 18px shadow. Respects `prefers-reduced-motion` (motion disabled).

### Demo media

Hero videos use `[data-autostagger]` — the layout script staggers their playback start (`140 + idx * 220ms`) and fades them in with `transform: translateY(6px) → 0`. Cosmetic, but it's the difference between "all videos popping in at once" and "graceful cascade."

### Lightbox

Demo screenshots/videos can have `[data-lightbox-src]` — clicking opens a fullscreen modal with backdrop + `body.modal-open` (locks scroll). Implemented inline in `Layout.astro`.

### Analytics hooks

- `[data-track="event_name"]` on any clickable element → fires `gtag('event', ...)`.
- `[data-track-submit="event_name"]` on a form → fires on submit.
- Keep these attributes when restructuring marketing pages; the funnel tracking depends on them.

### SEO

- Every page goes through `Layout.astro` props (`title`, `description`, `canonical`, `ogImage`). Default OG image is `/img/og-home-2026.jpg`.
- `theme-color: #bdb695` (brand tan).
- Landing pages (`gongfu-timer`, `tea-journal-app`, `tea-tasting-notes-app`, `myteapal-alternative`, `pricing`) are keyword-targeted — their `<title>` and `<meta description>` are part of the SEO contract.

---

## Cross-surface consistency

- Brand colors (`#bdb695`, `#898565`) are repeated in both surfaces — don't divert.
- Logo: always `🍵 Teanote` (emoji + word, no separator).
- App URLs: `app.teanote.xyz` for the SPA, `teanote.xyz` for marketing, `docs.teanote.xyz` for MkDocs.
- The site's CTAs always link to `https://app.teanote.xyz` or `/signup` — keep those URLs intact.

---

## Adding new UI — checklist

Before adding a component to the app:

1. Can you reuse an existing class? `.btn`, `.tea-item`, `section` inside `.{page}-content` cover most needs.
2. Are you using `var(--…)` for every color? If you hardcoded a hex, all four themes will look wrong.
3. Does it follow the 10/16/8 rhythm (gap 10, padding 16, radius 8)? If not, justify why.
4. Mobile behavior — does it stack at `≤860px`? Does the action row need `position: sticky; bottom: 90px`?
5. Strings — added the i18n key to all 5 lang JSON files (`en/sk/ja/zh/ko`)?
6. If you wrapped existing elements in a new `<div>`, did you check that no parent's `gap` / `display: flex|grid` relied on those elements being **direct** children? Wrapping silently breaks parent layout.

Before adding a section to the marketing site:

1. Use Tailwind utilities, not the app's CSS classes — they don't ship here.
2. Use `<Button>` for CTAs, not raw `<a class="…">`.
3. Wrap content in `max-w-6xl mx-auto px-4` to align with the rest of the site.
4. If it's a card grid, use `.tilt-card` for the hover affordance.
5. Add `data-track` to CTAs that matter for analytics.
