# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo of four independent sub-projects with no top-level package manager. Each has its own install/dev/build cycle.

- `client/` — React 19 + Vite + TypeScript SPA, the actual Teanote app (served at `app.teanote.xyz`).
- `site/` — Astro 5 marketing site + blog (served at `teanote.xyz`).
- `ai-service/` — Node 22 + Express 5 + TypeScript proxy to the Anthropic API (Claude Opus 5.5, `claude-opus-5-5`, via `@anthropic-ai/sdk`), deployed on Railway. Handles personalized AI dashboard insights.
- `supabase/` — Supabase config + Deno-based Edge Functions (legacy Stripe checkout + webhook, no longer called by the app; see "Payments: none"). **Gitignored** — exists only on Daniel's machine.
- `docs/` — MkDocs project (separate Python venv).

> **README.md is stale.** It describes an Express/GraphQL backend that no longer exists. The real backend is Supabase (Postgres + Auth + Edge Functions). Trust the code, not the README's "Tech Stack" or "Project Structure" sections.

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
- `VITE_AI_SERVICE_URL` (Railway URL for dashboard AI)

No code in `client/` reads `VITE_GOOGLE_CLIENT_ID` or `VITE_APPLE_CLIENT_ID`: Google/Apple sign-in goes through `supabase.auth.signInWithOAuth`, whose providers are configured in Supabase, not in this repo.

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
- `ANTHROPIC_API_KEY` (required: the service throws at start-up without it, so set it on Railway before deploying)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for JWT verification)
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
- `stores/useAuthStore.ts` is the single source of truth for the current user. On init it tries a synchronous read of a cached session from `localStorage`, then refreshes from `supabase.auth.getSession()`. That cached read (`getCachedSession()`) looks for a supabase-js v1 `currentSession` field, which the installed `@supabase/auth-js` 2.79.0 does not write (it stores the session object itself), so it currently always returns `null`: the user is known only once `getSession()` resolves, and until then `AppInitializer` renders the dummy nav/sidebar shell.
- Access needs only a signed-in user: there is no trial or subscription check, and the client never reads the `profiles` table. `ProtectedRoute` and `PublicRoute` check `user` (once `initialized`) and nothing else; `useAuthStore` has no separate access flag. `src/__tests__/components/ProtectedRoute.test.tsx` pins that `ProtectedRoute` lets any signed-in user through, sends a signed-out user to `/login` with `state.from`, and renders nothing before auth is initialized. `PublicRoute` has no test.
- `ProtectedRoute` / `PublicRoute` components guard the router tree in `main.tsx`.
- Sign-in supports email/password and Google/Apple OAuth (`signInWithProvider`).
- `signOut()` removes only **app-owned** localStorage keys (`teas`, `brews`, `presets`, `journals`, `theme`, and any `sb-*` / `auth-token` keys). It does **not** call `localStorage.clear()` — that wiped unrelated keys and other tabs' data.

## Payments: none

Teanote has been free since 2026-11-14: every signed-in user gets every feature, including the AI dashboard insights.

- No code path in `client/` or `ai-service/` reads trial or subscription state.
- The `profiles` columns `trial_start`, `subscription_start`, `subscription_end` and `is_subscribed` still exist in the database but are unused.
- The Stripe edge functions (`create-checkout-session`, `stripe-webhook`) still exist in the local-only `supabase/` folder and may still be deployed until Daniel retires them.
- The marketing site's `/pricing` page (`site/src/pages/pricing.astro`) shows the one free plan; its Product JSON-LD has a single Offer at price `"0"`.

## Architecture: AI dashboard insights

Two of the `<section className="stats">` cards on the Dashboard (`pages/DashboardPage.tsx`) render personalized AI commentary on the user's tea collection and recent brewing patterns.

- **Client**: `components/dashboard/AiInsights.tsx` is rendered twice with `slot="profile"` and `slot="patterns"`. Both instances share a single in-flight request via module-level state (`sharedInFlight` / `sharedResult` / `sharedError` + a Set of subscribers) — one ai-service request for both cards, not two. A successful result stays in that module state until a full page reload: later dashboard visits reuse it instead of fetching (a failed request is retried on the next visit), so a language change shows only after a reload.
- **Helper**: `helpers/ai.ts::getDashboardInsights` builds a compact summary (tea counts by type, recently added, brew totals + most-brewed + avg infusions, journal totals + avg rating + recent titles) and POSTs to `${VITE_AI_SERVICE_URL}/ai-dashboard-insights` with the Supabase JWT. The body has no email or user id, but it does carry tea names, journal titles and the language, and the service passes them on to Anthropic.
- **Service**: `ai-service/src/index.ts` verifies the JWT via Supabase, re-sanitizes every input, and answers a fixed empty-state text without calling the model when the user has no teas, brews or journals. Otherwise it calls `claude-opus-5-5` through `@anthropic-ai/sdk` (`anthropic.beta.messages.create`) with `output_config.effort: 'low'` and structured outputs (`output_config.format` with a JSON schema) for the `{profile, patterns}` shape. The schema can't express item counts or lengths, so `isValidInsights()` still checks for 1-4 paragraphs of 1-1000 characters each before it returns `{profile: string[], patterns: string[]}`.
- **Bounds**: `max_tokens` 4096, 30 s per HTTP attempt, `maxRetries: 1`, and a 60 s `AbortSignal.timeout` on the whole call (retry and any `retry-after` wait included). The server-side refusal fallback is on (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`): a request the safety classifiers decline is re-run on the model Anthropic picks for that category, and the service logs when a fallback model answered. `ANTHROPIC_API_KEY` goes through `requireEnv`, so the process throws at start-up when it is missing.
- **Per-user limit**: 10 model calls per account per hour (`AI_CALLS_PER_WINDOW` / `AI_WINDOW_MS`), counted before the call, so failed calls count and parallel requests can't overshoot; the empty-state answer doesn't count. Over the limit, the account's last good result from that hour is returned again with 200, or 429 with `Retry-After` when there is none. Counters live in memory in one process: a restart resets them, and each replica would keep its own.
- **Statuses**: 401 without a valid session; 429 as above; 502 when `stop_reason` is `refusal` ("AI declined the request") or `max_tokens` ("AI response was cut off"), or when the reply doesn't parse or fails `isValidInsights()` ("AI returned invalid shape"); 500 "internal error" for everything else, including every SDK error (auth, rate limit, timeout, deadline, connection), which `logAnthropicError()` logs by type without the key. The client shows `dash_ai_error` for any non-2xx.
- **Variety**: no `temperature` is sent — `claude-opus-5-5` rejects sampling parameters (`temperature` / `top_p` / `top_k` return a 400), and the request type in `@anthropic-ai/sdk` 1.8.0 has no such field. Variety now comes only from the prompt: a random pick from `STYLE_ANGLES`, a random nonce in the user prompt, and the system prompt's "vary your phrasing and opening" line. Don't remove any of these without expecting "same opening line every reload"; there is no sampling knob to fall back on.
- **Locale**: the user's `settings.language` is passed through; the AI responds in that language (en/sk/ja/zh/ko).
- **AI toggle**: gated on `settings.ai_enabled`. When off, the cards show a "turn on in Settings" hint instead of fetching. The gate is client-only: the service never reads `ai_enabled`.

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
