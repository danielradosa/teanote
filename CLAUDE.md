# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo of four independent sub-projects with no top-level package manager. Each has its own install/dev/build cycle.

- `client/` — React 19 + Vite + TypeScript SPA, the actual Teanote app (served at `app.teanote.xyz`).
- `site/` — Astro 5 marketing site + blog (served at `teanote.xyz`).
- `ai-service/` — Node 22 + Express 5 + TypeScript proxy to Groq, deployed on Railway. Handles personalized AI dashboard insights.
- `supabase/` — Supabase config + Deno-based Edge Functions (Stripe checkout + webhook). **Gitignored** — exists only on Daniel's machine.
- `docs/` — MkDocs project (separate Python venv).

> **README.md is stale.** It describes an Express/GraphQL/Lemon Squeezy backend that no longer exists. The real backend is Supabase (Postgres + Auth + Edge Functions) and payments are Stripe. Trust the code, not the README's "Tech Stack" or "Project Structure" sections.

For visual/design conventions (color tokens, spacing rhythm, theming, component patterns, marketing-site stack), see **`DESIGN.md`** at the repo root. Read it before adding any UI.

## Commands

### client/ (React app)

```sh
cd client
npm install
npm run dev          # Vite dev server (localhost:5173)
npm run build        # tsc -b && vite build → dist/
npm run lint         # eslint .
npm test             # vitest run (one-shot)
npm run test:watch   # vitest watch mode
npm run test:ui      # vitest browser UI
```

`tsconfig.json` is a project-references shell; the real configs are `tsconfig.app.json` (browser, includes `@/*` path alias to `./src/*` and Vitest globals) and `tsconfig.node.json` (Vite config).

**Imports**: use `@/...` aliases everywhere — relative `../foo` imports were swept out. Aliases are wired in `vite.config.ts`, `vitest.config.ts`, and `tsconfig.app.json`.

**Strict types**: all component props have proper interfaces backed by domain types in `@/types`. No `: any` props with `eslint-disable` directives anywhere. Don't reintroduce them.

Requires `client/.env` (gitignored) with:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_FUNCTIONS_URL` (for Stripe)
- `VITE_AI_SERVICE_URL` (Railway URL for dashboard AI)
- `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID` (OAuth)

### site/ (Astro marketing site)

```sh
cd site
npm install
npm run dev          # astro dev (localhost:4321)
npm run build        # astro build → dist/
npm run preview
```

### ai-service/ (Railway service)

```sh
cd ai-service
npm install
npm run dev          # tsx watch (localhost:8080)
npm run typecheck    # tsc --noEmit
npm start            # tsx (production)
```

Local dev needs `ai-service/.env` (gitignored — see `.env.example`):
- `GROQ_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for JWT verification + profile lookup)
- `PORT` (optional, defaults 8080), `CORS_ORIGIN` (defaults `*`)

Endpoint: `POST /ai-dashboard-insights` — returns `{profile: string[], patterns: string[]}` (1-4 short paragraphs each). Health: `GET /healthz`.

### supabase/

Edge functions are Deno scripts using import maps (`import_map.json`). The whole `supabase/` directory is gitignored — Daniel's local files only. Deploy via Supabase CLI. Local config is in `supabase/config.toml`.

### Deploying

- **Marketing site**: `./deploy.sh` from repo root rsyncs `site/dist/` to `info.teanote.xyz@ssh.teanote.xyz:/var/www11/...`.
- **ai-service**: `cd ai-service && railway up --service ai-service --detach`. Linked to project `teanote` (ID `16b8e8b0-bd5c-470d-831a-c0484f9bbca9`), service ID `e73a6754-e235-4a00-8e3b-20a822a3d2f9`. Public URL: `https://ai-service-production-9280.up.railway.app`.
- **Client app** and **edge functions** are deployed by other means not captured in this repo — ask before assuming.

## Architecture: the offline-first sync model

This is the most important thing to understand before editing any store or helper. Every domain entity (brews, presets, teas, journals, settings) follows the same pattern:

1. **localStorage is the working copy.** Each Zustand store hydrates from `storage.get('<key>')` on init, and every mutation writes to localStorage **before** attempting any network call.
2. **Soft deletes only.** Records are never removed — they get `deleted_at: <ISO timestamp>` set. `visibleX()` selectors filter these out. The merge logic preserves tombstones across devices.
3. **Last-write-wins by `updated_at`.** `helpers/merge.ts` reconciles local vs remote arrays by comparing `updated_at`, with one exception: a tombstone (`deleted_at` set) always wins over a live row regardless of timestamp.
4. **Sync is opportunistic.** Mutations call `syncX()` only `if (navigator.onLine)`. `components/SyncOnReconnect.tsx` triggers a full sync on the `online` event and every 5 minutes; failures surface a toast (`sync_failed_toast`) but don't block local writes.
5. **Realtime is per-user-per-table.** `helpers/realtime.ts::subscribeTable` opens a Supabase channel filtered by `user_id=eq.<uid>`. Stores expose `initRealtime`/`stopRealtime`; `helpers/realtimeStores.ts::initAllRealtime` wires them all up at once.

**Schema invariants every synced table must have:** `id` (uuid), `user_id`, `created_at`, `updated_at`, `deleted_at`. Without these, `syncData()` and `mergeRecords()` won't work. Don't break this contract.

The first test of merge behaviour lives in `src/__tests__/helpers/merge.test.ts` — covers LWW + tombstone-wins logic.

`useSyncStore` is a refcounting wrapper: multiple in-flight syncs increment `activeSyncs` and only the last one to finish flips `isSyncing` off — used for UI spinners.

## Architecture: auth & access

- `utils/supa.ts` exports a single shared Supabase client.
- `stores/useAuthStore.ts` is the single source of truth for the current user. It reads a cached session from `localStorage` synchronously on init (so first paint isn't blank), then refreshes from `supabase.auth.getSession()`.
- Access gating uses a `profiles` row with `trial_start`, `subscription_end`, `is_subscribed`. The 30-day trial is computed client-side from `trial_start`. `is_subscribed` is set by the Stripe webhook edge function.
- `ProtectedRoute` / `PublicRoute` components guard the router tree in `main.tsx`.
- Sign-in supports email/password and Google/Apple OAuth (`signInWithProvider`).
- `signOut()` removes only **app-owned** localStorage keys (`teas`, `brews`, `presets`, `journals`, `theme`, and any `sb-*` / `auth-token` keys). It does **not** call `localStorage.clear()` — that wiped unrelated keys and other tabs' data.

## Architecture: payments

- `supabase/functions/create-checkout-session` — takes `{ userId, priceId }`, looks up the user's email, returns a Stripe Checkout URL. Auth header required.
- `supabase/functions/stripe-webhook` — handles `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `subscription_schedule.updated`. Updates `profiles.is_subscribed` / `subscription_start` / `subscription_end` by email.
- `components/payment/Subscribe{Monthly,Yearly}.tsx` invoke the edge function and redirect to the returned URL.

## Architecture: AI dashboard insights

The two `<section className="stats">` cards on the Dashboard render personalized AI commentary on the user's tea collection and recent brewing patterns.

- **Client**: `components/dashboard/AiInsights.tsx` is rendered twice with `slot="profile"` and `slot="patterns"`. Both instances share a single in-flight request via module-level state (`sharedInFlight` / `sharedResult` / `sharedError` + a Set of subscribers) — one Groq call per dashboard mount, not two. No cache: every dashboard visit gets a fresh overview.
- **Helper**: `helpers/ai.ts::getDashboardInsights` builds a compact, anonymized summary (tea counts by type, recently added, brew totals + most-brewed + avg infusions, journal totals + avg rating + recent titles) and POSTs to `${VITE_AI_SERVICE_URL}/ai-dashboard-insights` with the Supabase JWT.
- **Service**: `ai-service/src/index.ts` verifies the JWT via Supabase, checks subscription/trial via the `profiles` table (402 if neither active), re-sanitizes every input, calls Groq `llama-3.3-70b-versatile` with `response_format: json_object`, validates the returned shape, and returns `{profile: string[], patterns: string[]}` (1-4 short paragraphs each).
- **Variety**: temperature 0.95 + a random pick from `STYLE_ANGLES` + a random nonce in the user prompt make each response noticeably different. Don't lower these without expecting "same opening line every reload".
- **Locale**: the user's `settings.language` is passed through; the AI responds in that language (en/sk/ja/zh/ko).
- **AI toggle**: gated on `settings.ai_enabled`. When off, the cards show a "turn on in Settings" hint instead of fetching.

## Theming

Themes are CSS files in `client/public/themes/` (`default`, `cozy`, `night`, `sakura`). They are loaded by injecting a `<link id="theme-css">` at runtime — there is no build-time CSS-in-JS. Swap implementation lives in `AppInitializer.applyTheme()` only.

## Routing

`client/src/main.tsx` is the single source for routes. Every page is loaded via `React.lazy()` and rendered inside a `<Suspense>` boundary with a centered `Loader` fallback. The recharts-heavy Dashboard chunk is ~270 KB and only loads when you visit `/` — don't accidentally re-add an eager import for it from `main.tsx`.

Protected routes are nested under `App`, which renders `DesktopNav` + `DesktopSidebar` + `<Outlet/>`. There is no separate mobile shell — responsive handling lives in `styles/responsive.css`.

## i18n

`client/src/lang/index.ts` registers 5 locales: `en`, `sk`, `ja`, `zh`, `ko`. Language is read from `useSettingsStore().settings.language` and applied via `i18n.changeLanguage()` in `AppInitializer`. When adding user-facing strings, add the key to **all five** JSON files or `fallbackLng: 'en'` will surface in non-English UIs.

## Site (Astro)

- `astro.config.mjs` — Tailwind 4 via the Vite plugin (no separate `tailwind.config`); `@astrojs/sitemap` integration; site URL `https://teanote.xyz`; markdown `smartypants: false`.
- Blog uses Astro content collections (`src/content/config.ts` schema: `title`, `description`, `pubDate`, optional `updatedDate`, `heroImage`, `tags`).
- Landing pages (`gongfu-timer.astro`, `myteapal-alternative.astro`, `tea-journal-app.astro`, `tea-tasting-notes-app.astro`, `pricing.astro`) are SEO-targeted — keep their meta/structured data intact when editing.

## Conventions worth knowing

- Stores are plain Zustand (no middleware), and every mutation manually mirrors state to `localStorage`. Don't reach for `zustand/middleware/persist` — the manual approach is intentional because the same shape is then fed into the merge/sync pipeline.
- IDs are generated client-side with `uuid()` so a record exists in localStorage immediately and gets reconciled to Supabase on next sync. Don't introduce server-generated IDs without rewriting sync.
- Auth pages submit on Enter — `LoginPage` / `SignupPage` wrap inputs in `<form onSubmit={...}>` with `type="submit"` buttons. Keep that pattern if you add new auth flows.
- Image upload (in `TeaForm`) validates MIME type + 8 MB cap and auto-resizes to 1920px / quality 0.85 JPEG via `helpers/image.ts` (canvas, no deps). Don't reintroduce raw `uploadImage(file)` without validation.
- Error handling in stores is mostly `console.warn`/`console.error` with no UI surfacing — sync failures are caught by `SyncOnReconnect` and shown as a toast (`sync_failed_toast`). `react-hot-toast` is the toast library (the `<Toaster/>` lives in `App.tsx`).
- `BrewPage` orchestrates 8 brew/preset components in `components/brew/` (`BrewFilters`, `BrewList`, `BrewItem`, `BrewTimer`, `PresetForm`, `PresetList`, `PresetItem`, `PresetEditForm`, `NewSessionForm`). It owns only cross-cutting state (active brew, live timer fields, search, which preset is being edited); form-local state lives inside each child. Mirror that pattern if you split another large page.
- Tests live in `client/src/__tests__/` mirroring the source tree. See the README in that folder for conventions. Vitest globals (`describe`/`it`/`expect`/`vi`) are configured — don't import them.
