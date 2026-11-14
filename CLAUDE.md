# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo of four independent sub-projects with no top-level package manager. Each has its own install/dev/build cycle.

- `client/` — React 19 + Vite + TypeScript SPA, the actual Teanote app (served at `app.teanote.xyz`).
- `site/` — Astro 5 marketing site + blog (served at `teanote.xyz`).
- `ai-service/` — Node 22 + Express 5 + TypeScript proxy to the Anthropic API (Claude Opus 5.5, `claude-opus-5-5`, via `@anthropic-ai/sdk`), deployed on Railway. Handles personalized AI dashboard insights.
- `supabase/` — Deno-based Edge Functions (legacy Stripe checkout + webhook, no longer called by the app; see "Payments: none") and `schema-snapshot.sql`, a readable record of the hosted database. Both are tracked since 2026-11-14. `supabase/.env`, `config.toml` and the CLI's local state are **gitignored** and exist only on Daniel's machine. The repository is public: never un-ignore `supabase/.env`.
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

Nothing loads a `.env` file: the `dev` script is plain `tsx watch src/index.ts`, tsx reads one only when given `--env-file`, and the service has no `dotenv`. So there is no `ai-service/.env` to create. Run local dev from `ai-service/` as `railway run --service ai-service -- npm run dev`, which injects the Railway service's variables into the local process; they are the deployed service's real values, so a local model call is billed to its Anthropic key. The service reads:
- `ANTHROPIC_API_KEY` (required: the service throws at start-up without it, so set it on Railway before deploying)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (for JWT verification)
- `PORT` (optional, defaults 8080), `CORS_ORIGIN` (defaults `*`)

On 2026-11-14 the Railway service set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `CORS_ORIGIN` (to `*`) but not `PORT`, so under `railway run` the service listens on 8080.

Endpoint: `POST /ai-dashboard-insights` — returns `{profile: string[], patterns: string[]}` (1-4 short paragraphs each). Health: `GET /healthz`.

### supabase/

Edge functions are Deno scripts using import maps (`import_map.json`); their sources are tracked. Deploy via Supabase CLI. Local config is in `supabase/config.toml` (gitignored).

`supabase/schema-snapshot.sql` records the hosted project's tables, indexes, row-level security, policies, functions, triggers, storage buckets and realtime publication, read from the Postgres catalog on 2026-11-14. It is a readable record, not a migration: the project has no migration history, and the file has never been run against an empty database. Every table has RLS on with owner-only policies, and both storage buckets (`teas`, `sessions`) are private with per-user-folder policies. Update the snapshot when the schema changes in the dashboard; for a baseline that can rebuild the database, run `supabase db pull` (needs Docker and the database password).

### Deploying

- **Marketing site**: `./deploy.sh` from repo root rsyncs `site/dist/` to `info.teanote.xyz@ssh.teanote.xyz:/var/www11/...`.
- **ai-service**: `cd ai-service && railway up --service ai-service --detach`. Linked to project `teanote` (ID `16b8e8b0-bd5c-470d-831a-c0484f9bbca9`), service ID `e73a6754-e235-4a00-8e3b-20a822a3d2f9`. Public URL: `https://ai-service-production-9280.up.railway.app`.
- **Client app**: the Railway project `teanote` also has a service named `teanote` that builds `/client` from GitHub `danielradosa/teanote`, branch `main`, so every push to `main` deploys the app. Its build settings live on Railway; no file in this repo configures them. The `ai-service` service has no GitHub source: a push never deploys it, only `railway up` does (both checked with the Railway CLI on 2026-11-14).
- **Order**: deploy the AI service first, and push a client change that depends on it only once that deploy is live; pushing first ships a client that calls the old service.
- **Edge functions** are deployed by other means not captured in this repo — ask before assuming.

## Architecture: the offline-first sync model

This is the most important thing to understand before editing any store or helper. Every domain entity (brews, presets, teas, journals) follows the same pattern:

1. **localStorage is the working copy.** Each Zustand store hydrates from `storage.get('<key>')` on init, and every mutation writes to localStorage **before** attempting any network call.
2. **Soft deletes only.** Records are never removed — they get `deleted_at: <ISO timestamp>` set. `visibleX()` selectors filter these out. The merge logic preserves tombstones across devices.
3. **Last-write-wins by `updated_at`.** `helpers/merge.ts` reconciles local vs remote arrays by comparing `updated_at`, with one exception: a tombstone (`deleted_at` set) always wins over a live row regardless of timestamp.
4. **Sync is opportunistic.** Mutations call `syncX()` only `if (navigator.onLine)`. `components/SyncOnReconnect.tsx` triggers a full sync on the `online` event and every 5 minutes; failures surface a toast (`sync_failed_toast`) but don't block local writes.
5. **Realtime is per-user-per-table.** `helpers/realtime.ts::subscribeTable` opens a Supabase channel filtered by `user_id=eq.<uid>`. Stores expose `initRealtime`/`stopRealtime`; `helpers/realtimeStores.ts::initAllRealtime` wires them all up at once.

Settings are the exception: `useSettingsStore` has no localStorage copy (`settings` starts as `null`; `AppInitializer` mirrors only the theme name to `localStorage.theme`), `updateSettings()` writes straight to the `settings` table, and `syncSettings()` just re-runs `loadSettings()`. Of the points above, only per-user realtime (5) applies to it, through its own channel rather than `subscribeTable`.

**Schema invariants every synced table must have:** `id` (uuid), `user_id`, `created_at`, `updated_at`, `deleted_at`. Without these, `syncData()` and `mergeRecords()` won't work. Don't break this contract.

The first test of merge behaviour lives in `src/__tests__/helpers/merge.test.ts` — covers LWW + tombstone-wins logic.

`useSyncStore` is a refcounting wrapper: multiple in-flight syncs increment `activeSyncs` and only the last one to finish flips `isSyncing` off — used for UI spinners.

## Architecture: auth & access

- `utils/supa.ts` exports a single shared Supabase client.
- `stores/useAuthStore.ts` is the single source of truth for the current user. `getCachedSession()` reads the session that supabase-js 2.x keeps as JSON under the `sb-<project ref>-auth-token` localStorage key, and accepts it only when it has a string `access_token` and `user.id`. The store's initial state and the first `set()` in `initAuth()` come from it, so `initialized` is true, with the cached user, before `supabase.auth.getSession()` settles.
- `getSession()` then decides. A session it returns replaces the cached one. No session with no error, or an auth-server rejection (a revoked or expired refresh token comes back as an `AuthApiError`, and auth-js deletes the stored session), signs the user out. Only an `AuthRetryableFetchError` (the auth server could not be reached: the device is offline) keeps the cached session (`keptOffline`); auth-js reports that same failed refresh as an `INITIAL_SESSION` with no session, and the `onAuthStateChange` listener ignores that event only when `keptOffline` is set. Every other auth event sets `user` and `session` from the event. auth-js returns a stored access token that is more than 90 s from expiry without any network call, so being offline matters only once it is (nearly) expired; then auth-js retries the refresh with backoff for about 25 s before `getSession()` returns the error.
- `AppInitializer` still awaits the whole `initAuth()`, `getSession()` included, before it renders the real UI, and shows the dummy nav/sidebar shell (`DesktopNavDummy` / `DesktopSidebarDummy`) until then. So there is no cached first paint yet: the cached session only decides who is signed in when the auth server can't be reached, and an offline start with an expired token shows the shell for those ~25 s.
- Settings are first loaded by `SyncOnReconnect`'s first sync (`syncSettings()`), not by `AppInitializer`. `SyncOnReconnect` is mounted in `DesktopSidebar`, inside the protected `App` shell, and its effect depends on `user?.id` rather than the user object, so it starts once a signed-in user is known and restarts only when the account changes, not on token refreshes. `SettingsPage` loads them again on mount.
- Access needs only a signed-in user: there is no trial or subscription check, and the client never reads the `profiles` table. `ProtectedRoute` and `PublicRoute` check `user` (once `initialized`) and nothing else; `useAuthStore` has no separate access flag. `ProtectedRoute` sends a signed-out user to `/login` with their location in `state.from`; `PublicRoute` sends a signed-in user to that remembered path (pathname, search and hash), or to `/` when there is none or it would leave the app's origin.
- Tests in `src/__tests__/`: `components/ProtectedRoute.test.tsx` pins that `ProtectedRoute` lets any signed-in user through, sends a signed-out user to `/login` with `state.from`, and renders nothing before auth is initialized. `components/PublicRoute.test.tsx` pins the redirect to the remembered path (also when the user signs in on the page), `/` without one or for an off-site `from` (full URL, `//host`, `/\host`), the page for a signed-out user, and nothing before auth is initialized. `stores/useAuthStore.test.ts` re-imports the store per test (the cached session is read at module load) and pins the cached read (a stored non-session is ignored), each `getSession()` outcome above with and without a cache, the `keptOffline` `INITIAL_SESSION` guard both ways, and that `signOut()` clears only app-owned keys.
- `ProtectedRoute` / `PublicRoute` components guard the router tree in `main.tsx`.
- Sign-in supports email/password and Google/Apple OAuth (`signInWithProvider`).
- `signOut()` removes only **app-owned** localStorage keys (`teas`, `brews`, `presets`, `journals`, `theme`, and any `sb-*` / `auth-token` keys). It does **not** call `localStorage.clear()` — that wiped unrelated keys and other tabs' data.

## Payments: none

Teanote has been free since 2026-11-14: every signed-in user gets every feature, including the AI dashboard insights.

- No code path in `client/` or `ai-service/` reads trial or subscription state.
- The `profiles` columns `trial_start`, `subscription_start`, `subscription_end` and `is_subscribed` still exist in the database but are unused.
- The Stripe edge functions (`create-checkout-session`, `stripe-webhook`) still exist in `supabase/functions/` and were both still deployed and active on 2026-11-14; they stay until Daniel retires them.
- The marketing site's `/pricing` page (`site/src/pages/pricing.astro`) shows the one free plan; its Product JSON-LD has a single Offer at price `"0"`.

## Architecture: AI dashboard insights

Two of the `<section className="stats">` cards on the Dashboard (`pages/DashboardPage.tsx`) render personalized AI commentary on the user's tea collection and recent brewing patterns.

- **Client**: `components/dashboard/AiInsights.tsx` is rendered twice with `slot="profile"` and `slot="patterns"`. Both instances share a single in-flight request via module-level state (`sharedInFlight` / `sharedResult` / `sharedError` + a Set of subscribers) — one ai-service request for both cards, not two. A successful result stays in that module state until a full page reload: later dashboard visits reuse it instead of fetching (a failed request is retried on the next visit), so a language change shows only after a reload.
- **Helper**: `helpers/ai.ts::getDashboardInsights` builds a compact summary (tea counts by type, recently added, brew totals + most-brewed + avg infusions, journal totals + avg rating + recent titles) and POSTs to `${VITE_AI_SERVICE_URL}/ai-dashboard-insights` with the Supabase JWT. The body has no email or user id, but it does carry tea names, journal titles and the language, and the service passes them on to Anthropic.
- **Service**: `ai-service/src/index.ts` verifies the JWT via Supabase, re-sanitizes every input, and answers a fixed empty-state text without calling the model when the user has no teas, brews or journals. Otherwise it calls `claude-opus-5-5` through `@anthropic-ai/sdk` (`anthropic.beta.messages.create`) with `output_config.effort: 'low'` and structured outputs (`output_config.format` with a JSON schema) for the `{profile, patterns}` shape. The schema can't express item counts or lengths, so `isValidInsights()` still checks for 1-4 paragraphs of 1-1000 characters each before it returns `{profile: string[], patterns: string[]}`.
- **Bounds**: `max_tokens` 4096, 30 s per HTTP attempt, `maxRetries: 1`, and a 60 s `AbortSignal.timeout` on the whole call (retry and any `retry-after` wait included). The server-side refusal fallback is on (`betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`): a request the safety classifiers decline is re-run on the model Anthropic picks for that category, and the service logs when a fallback model answered. `ANTHROPIC_API_KEY` goes through `requireEnv`, so the process throws at start-up when it is missing.
- **Per-user limit**: 10 model calls per account per hour (`AI_CALLS_PER_WINDOW` / `AI_WINDOW_MS`), counted before the call, so failed calls count and parallel requests can't overshoot; the empty-state answer doesn't count, and a malformed request is rejected with 400 before the limit is checked or counted, so it costs nothing. Over the limit, the account's last good result from that hour is returned again with 200, or 429 with `Retry-After` when there is none. Counters live in memory in one process: a restart resets them, and each replica would keep its own.
- **Statuses**: 401 without a valid session; 400 "invalid request body: …" for malformed input: a body that isn't a JSON object (invalid JSON or a bare top-level value, which `express.json` rejects before the session check; an array; no JSON body), or a present, non-null `teas`, `brews`, `journals`, `teas.byType` or `brews.mostBrewedTea` that isn't an object, or `teas.recentlyAdded` / `journals.recentTitles` that isn't an array (`bodyShapeError()`; a scalar of the wrong type is still zeroed or dropped by the sanitizers, not rejected); 429 as above; 502 when `stop_reason` is `refusal` ("AI declined the request") or `max_tokens` ("AI response was cut off"), or when the reply doesn't parse or fails `isValidInsights()` ("AI returned invalid shape"); 500 "internal error" for everything else, including a body over the 16 kB `express.json` limit and every SDK error (auth, rate limit, timeout, deadline, connection), which `logAnthropicError()` logs by type without the key. The client shows `dash_ai_error` for any non-2xx.
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
- Social tags: `layouts/Layout.astro` writes every `og:` and `twitter:` meta tag. A page changes them only through the Layout props `ogType`, `ogTitle`, `ogDescription`, `ogImage`, `twitterTitle` and `twitterDescription` (unset ones fall back to `website`, `title`, `description` and the default `og-home-2026.jpg`). Never add `og:` or `twitter:` meta tags in `slot="head"`, or the page carries those tags twice.
- JSON-LD built from frontmatter values: make it an object in the frontmatter and render `<script type="application/ld+json" set:html={JSON.stringify(obj)}></script>`, as `blog/index.astro` and `blog/[...slug].astro` do. A plain `<script type="application/ld+json">` is emitted verbatim, so `${...}` inside it reaches the page literally; fixed JSON with no expressions (as on `index.astro` and `pricing.astro`) is fine.

## Conventions worth knowing

- Stores are plain Zustand (no middleware), and every mutation manually mirrors state to `localStorage` (settings excepted, see the sync model). Don't reach for `zustand/middleware/persist` — the manual approach is intentional because the same shape is then fed into the merge/sync pipeline.
- IDs are generated client-side with `uuid()` so a record exists in localStorage immediately and gets reconciled to Supabase on next sync. Don't introduce server-generated IDs without rewriting sync.
- Auth pages submit on Enter — `LoginPage` / `SignupPage` wrap inputs in `<form onSubmit={...}>` with `type="submit"` buttons. Keep that pattern if you add new auth flows.
- Image upload (in `TeaForm`) validates MIME type + 8 MB cap and auto-resizes to 1920px / quality 0.85 JPEG via `helpers/image.ts` (canvas, no deps). Don't reintroduce raw `uploadImage(file)` without validation.
- Error handling in stores is mostly `console.warn`/`console.error` with no UI surfacing — sync failures are caught by `SyncOnReconnect` and shown as a toast (`sync_failed_toast`). `react-hot-toast` is the toast library (the `<Toaster/>` lives in `App.tsx`).
- `BrewPage` orchestrates 8 brew/preset components in `components/brew/` (`BrewFilters`, `BrewList`, `BrewItem`, `BrewTimer`, `PresetForm`, `PresetList`, `PresetItem`, `PresetEditForm`, `NewSessionForm`). It owns only cross-cutting state (active brew, live timer fields, search, which preset is being edited); form-local state lives inside each child. Mirror that pattern if you split another large page.
- Tests live in `client/src/__tests__/` mirroring the source tree. See the README in that folder for conventions. Vitest globals (`describe`/`it`/`expect`/`vi`) are configured — don't import them.
