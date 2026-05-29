# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo of three independent sub-projects with no top-level package manager. Each has its own install/dev/build cycle.

- `client/` — React 19 + Vite + TypeScript SPA, the actual Teanote app (served at `app.teanote.xyz`).
- `site/` — Astro 5 marketing site + blog (served at `teanote.xyz`).
- `supabase/` — Supabase config + Deno-based Edge Functions (Stripe checkout + webhook).
- `docs/` — MkDocs project (separate Python venv).

> **README.md is stale.** It describes an Express/GraphQL/Lemon Squeezy backend that no longer exists. The real backend is Supabase (Postgres + Auth + Edge Functions) and payments are Stripe. Trust the code, not the README's "Tech Stack" or "Project Structure" sections.

For visual/design conventions (color tokens, spacing rhythm, theming, component patterns, marketing-site stack), see **`DESIGN.md`** at the repo root. Read it before adding any UI.

## Commands

### client/ (React app)

```sh
cd client
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build → dist/
npm run lint       # eslint .
npm run preview    # serve built dist/
```

No test runner is configured. `tsconfig.json` is a project-references shell; the real configs are `tsconfig.app.json` (browser) and `tsconfig.node.json` (Vite config).

Requires `client/.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (gitignored).

### site/ (Astro marketing site)

```sh
cd site
npm install
npm run dev        # astro dev (localhost:4321)
npm run build      # astro build → dist/
npm run preview
```

### supabase/

Edge functions are Deno scripts using import maps (`import_map.json`). Deploy via Supabase CLI; do not try to `npm install` here. Local config is in `supabase/config.toml`.

### Deploying

`./deploy.sh` from repo root **only deploys the Astro marketing site** (rsync to `info.teanote.xyz@ssh.teanote.xyz:/var/www11/...`). The client app and edge functions are deployed by other means not captured in this repo — ask before assuming.

## Architecture: the offline-first sync model

This is the most important thing to understand before editing any store or helper. Every domain entity (brews, presets, teas, journals, settings) follows the same pattern:

1. **localStorage is the working copy.** Each Zustand store hydrates from `storage.get('<key>')` on init, and every mutation writes to localStorage **before** attempting any network call.
2. **Soft deletes only.** Records are never removed — they get `deleted_at: <ISO timestamp>` set. `visibleX()` selectors filter these out. The merge logic preserves tombstones across devices.
3. **Last-write-wins by `updated_at`.** `helpers/merge.ts` reconciles local vs remote arrays by comparing `updated_at`, with one exception: a tombstone (`deleted_at` set) always wins over a live row regardless of timestamp.
4. **Sync is opportunistic.** Mutations call `syncX()` only `if (navigator.onLine)`. `components/SyncOnReconnect.tsx` triggers a full sync on the `online` event and every 5 minutes.
5. **Realtime is per-user-per-table.** `helpers/realtime.ts::subscribeTable` opens a Supabase channel filtered by `user_id=eq.<uid>`. Stores expose `initRealtime`/`stopRealtime`; `helpers/realtimeStores.ts::initAllRealtime` wires them all up at once.

**Schema invariants every synced table must have:** `id` (uuid), `user_id`, `created_at`, `updated_at`, `deleted_at`. Without these, `syncData()` and `mergeRecords()` won't work. Don't break this contract.

`useSyncStore` is a refcounting wrapper: multiple in-flight syncs increment `activeSyncs` and only the last one to finish flips `isSyncing` off — used for UI spinners.

## Architecture: auth & access

- `utils/supa.ts` exports a single shared Supabase client.
- `stores/useAuthStore.ts` is the single source of truth for the current user. It reads a cached session from `localStorage` synchronously on init (so first paint isn't blank), then refreshes from `supabase.auth.getSession()`.
- Access gating uses a `profiles` row with `trial_start`, `subscription_end`, `is_subscribed`. The 30-day trial is computed client-side from `trial_start`. `is_subscribed` is set by the Stripe webhook edge function.
- `ProtectedRoute` / `PublicRoute` components guard the router tree in `main.tsx`.
- Sign-in supports email/password and Google/Apple OAuth (`signInWithProvider`).

## Architecture: payments

- `supabase/functions/create-checkout-session` — takes `{ userId, priceId }`, looks up the user's email, returns a Stripe Checkout URL. Auth header required.
- `supabase/functions/stripe-webhook` — handles `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `subscription_schedule.updated`. Updates `profiles.is_subscribed` / `subscription_start` / `subscription_end` by email.
- `components/payment/Subscribe{Monthly,Yearly}.tsx` invoke the edge function and redirect to the returned URL.

## Theming

Themes are CSS files in `client/public/themes/` (`default`, `cozy`, `night`, `sakura`). They are loaded by injecting a `<link id="theme-css">` at runtime — there is no build-time CSS-in-JS.

**Quirk:** there are two implementations of the theme swap — `AppInitializer.applyTheme()` and `components/layout/ThemeManager.tsx` — and they use different element IDs (`theme-css` vs `theme-link`). If you touch theming, expect to deduplicate or at least understand both paths before changing one.

## Routing

`client/src/main.tsx` is the single source for routes. Protected routes are nested under `App`, which renders `DesktopNav` + `DesktopSidebar` + `<Outlet/>`. There is no separate mobile shell — responsive handling lives in `styles/responsive.css`.

## i18n

`client/src/lang/index.ts` registers 5 locales: `en`, `sk`, `ja`, `zh`, `ko`. Language is read from `useSettingsStore().settings.language` and applied via `i18n.changeLanguage()` in `AppInitializer`. When adding user-facing strings, add the key to **all five** JSON files or `fallbackLng: 'en'` will surface in non-English UIs.

## Site (Astro)

- `astro.config.mjs` — Tailwind 4 via the Vite plugin (no separate `tailwind.config`); `@astrojs/sitemap` integration; site URL `https://teanote.xyz`; markdown `smartypants: false`.
- Blog uses Astro content collections (`src/content/config.ts` schema: `title`, `description`, `pubDate`, optional `updatedDate`, `heroImage`, `tags`).
- Landing pages (`gongfu-timer.astro`, `myteapal-alternative.astro`, `tea-journal-app.astro`, `tea-tasting-notes-app.astro`, `pricing.astro`) are SEO-targeted — keep their meta/structured data intact when editing.

## Conventions worth knowing

- Stores are plain Zustand (no middleware), and every mutation manually mirrors state to `localStorage`. Don't reach for `zustand/middleware/persist` — the manual approach is intentional because the same shape is then fed into the merge/sync pipeline.
- IDs are generated client-side with `uuid()` so a record exists in localStorage immediately and gets reconciled to Supabase on next sync. Don't introduce server-generated IDs without rewriting sync.
- Error handling in stores is mostly `console.warn`/`console.error` with no UI surfacing — sync failures are silent by design (the next online tick will retry). `react-hot-toast` is used for user-facing notifications.
