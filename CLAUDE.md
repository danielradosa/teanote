# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

This is a monorepo of five independent sub-projects with no top-level package manager. Each has its own install/dev/build cycle.

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

On Daniel's machine `npm run dev` talks to the hosted Supabase project and the production AI service, so clicking around locally changes live data and bills model calls (seen in the request logs of 2026-11-14).

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

**Domain and DNS** (measured 2026-11-15):
- The `teanote.xyz` zone is hosted at HostCreators (`ns1`–`ns3.hostcreators.sk`, `ns4.hostcreators.eu`), which also hosts the marketing site and the docs (web host `193.163.77.21`); `ssh.teanote.xyz` is a CNAME to its SSH endpoint `ssh.hostcreators.sk`.
- `app.teanote.xyz` is a CNAME to `hzd2krcl.up.railway.app`; the app is always reachable at `teanote-production.up.railway.app`.
- The registrar is Gransy s.r.o. (Regtons); the registration renews every 3 November.
- On 2026-11-04 the registration lapsed and the registrar parked the whole domain on `ns.parktons.com`, which answers every hostname with 429 or an advertising redirect and closes port 22. When a public name misbehaves, check `dig +short NS teanote.xyz` before anything else.

## Architecture: the offline-first sync model

This is the most important thing to understand before editing any store or helper. Every domain entity (brews, presets, teas, journals) follows the same pattern:

1. **localStorage is the working copy.** Each Zustand store hydrates from `storage.get('<key>')` on init, and every mutation writes to localStorage **before** attempting any network call. One exception: `deleteTea` first awaits the removal of the tea's photo file (see "Tea photos").
2. **Soft deletes only.** No row is ever removed from the server: a delete sets `deleted_at: <ISO timestamp>` (and `updated_at`). `visibleX()` selectors filter these out. The merge logic preserves tombstones across devices. On this device a tombstone stays in localStorage only until a sync settles it: it is dropped once the server has accepted it, already had the row marked deleted, or never had the row, and kept while the server rejects it, so the next sync sends it again. Another account's tombstone is never sent and stays (see "Another account's records"). The in-memory store keeps the tombstones a sync returns until a reload.
3. **Last-write-wins by `updated_at`.** `helpers/merge.ts` reconciles local vs remote arrays by comparing `updated_at`, with one exception: a tombstone (`deleted_at` set) always wins over a live row regardless of timestamp.
4. **Sync is opportunistic and reports failure instead of throwing.** Mutations call `syncX()` only `if (navigator.onLine)` and ignore its result. `components/SyncOnReconnect.tsx` runs a full sync (teas, journals, brews, presets, settings) as soon as a signed-in user is known, without checking `navigator.onLine`, then on every `online` event and every 5 minutes while `navigator.onLine`. Failures never block local writes.
5. **Realtime is per-user-per-table.** `helpers/realtime.ts::subscribeTable` opens a Supabase channel filtered by `user_id=eq.<uid>`. Stores expose `initRealtime`/`stopRealtime`; `helpers/realtimeStores.ts::initAllRealtime` wires them all up at once.

Settings are the exception: `useSettingsStore` has no localStorage copy (`settings` starts as `null`; `AppInitializer` mirrors only the theme name to `localStorage.theme`), `updateSettings()` writes straight to the `settings` table, and `syncSettings()` just re-runs `loadSettings()`. Of the points above, only per-user realtime (5) applies to it, through its own channel rather than `subscribeTable`. `syncSettings()` resolves nothing and `loadSettings()` only logs its errors, so a failed settings load never raises `sync_failed_toast`.

**`syncData(table, key, toRecord?)`** (`helpers/sync.ts`) never throws; it returns `{ records, ok }`. `records` is the merged array, tombstones included, or `null` when nothing could be pulled; `ok` is true only when the pull and every write succeeded. The pull is paged: `select('*')` for the user, ordered by `id`, in `range()` pages of 1000, advancing by the rows actually received and stopping at an empty page, so a server `max-rows` cap below the page size loses nothing. Any failed page fails the sync, which then writes nothing and leaves localStorage as it was. Leaving out another account's records (below), it upserts every live row the server lacks or holds with an older `updated_at`, and sends a tombstone (`update` of `deleted_at` + `updated_at`) only for a row the server has live; every write's error is checked, and a failed one stays local for the next sync to send again. Every upsert sends `user_id` as the signed-in user. `toRecord` is described under "Records the server would reject".

**Another account's records.** Only `signOut()` clears the record keys, so a session that ended without it leaves its records in this browser for the next account that signs in. `syncData` never sends a stored record whose `user_id` is set and is not the signed-in user's, as an upsert or as a tombstone, and does not count it as a failed write; its own write-back keeps such a record exactly as stored, tombstones included. A record with no `user_id` is still sent as the signed-in user's. `records` returns them like any other (with `toRecord` applied), so they stay in the lists, raise no `sync_failed_toast`, and can be edited and deleted on this device without anything reaching the server; the store's next mutation writes its whole array, so their repaired copies reach localStorage then. Hiding, clearing or moving them is an open decision for Daniel.

`syncTeas` / `syncJournals` / `syncBrews` / `syncPresets` resolve that `ok` as a boolean and never reject; they replace the store's array with `records` when it is not `null`. `SyncOnReconnect` shows one `sync_failed_toast` for a round in which any of them resolves `false`, however many rows and tables failed. An app start with no network is such a round: the pull fails, so the toast shows. A mutation's own background sync shows no toast.

**Schema invariants every table synced by `syncData()` must have:** `id` (uuid), `user_id`, `updated_at`, `deleted_at`. The pull filters on `user_id` and orders by `id`, tombstones are matched on `id` and `user_id`, and `mergeRecords()` compares `updated_at` and `deleted_at`. Neither reads a creation date: `brews` and `presets` have `created_at`, while `teas` and `journals` have `"dateAdded"` instead (both default to `now()` on the server; the client sets `dateAdded` itself, see "Records the server would reject"). Without these, `syncData()` and `mergeRecords()` won't work. Don't break this contract.

The first test of merge behaviour lives in `src/__tests__/helpers/merge.test.ts` — covers LWW + tombstone-wins logic.

`useSyncStore` is a refcounting wrapper: multiple in-flight syncs increment `activeSyncs` and only the last one to finish flips `isSyncing` off — used for UI spinners. `roundFailed` remembers a failure from any sync of an overlapping round until the last one finishes; that round then sets neither `justSynced` nor `lastSync` (the sidebar's "synced at"), so a sync that happens to finish last cannot hide another's failure.

## Records the server would reject

The server (PostgREST in front of Postgres) refuses a whole upsert for one bad value, and a refused record fails every sync and stays on one device. What it refuses: a key that is not a column (PGRST204), an empty string in a `uuid` or timestamp column, a fraction in an `integer` column or `integer[]` element, a number outside the int4 range, a null in a not-null column. `helpers/records.ts` shapes records for the tables that need it:

- `toJournalRecord`: `brew_preset_id` `''` (the form's "no brew" choice) becomes `null`; the uuid column holds the linked **brew's** id, despite its name. A fractional `rating` is rounded to the nearest whole number. A rating outside the int4 range is left as typed, so the server keeps refusing it; there is no range rule here (the form's is under "Journal ratings"). A journal without `dateAdded` gets its own `updated_at` as `dateAdded`.
- `toTeaRecord`: a tea has nothing the server would refuse; it only sets a missing `dateAdded` the same way.
- `toPresetRecord`: every `infusionTimes` entry is rounded to whole seconds and clamped to the int4 range.
- **`dateAdded`** is when the journal or tea was written on the device: `addJournal` and `addTea` set it to the same instant as `updated_at`. Older versions never set it, so the column's default dated a record by its first insert, days late for one written offline or stuck. The repair never changes a record that has a `dateAdded`. A local copy without one that carries an unsent edit is sent with the repaired date, which replaces the date the server gave the row at insert.
- The stores apply them on add and update (`addJournal`, `updateJournal`, `addPreset`, `updatePreset`; `updateJournal` and `updateTea` also repair the stored copy before applying the edit, so an undated record is dated by its last write, not by the edit), and `syncJournals` / `syncTeas` / `syncPresets` pass them to `syncData` as `toRecord`, which applies it to every record read from localStorage before the merge, so a record an older version stored in a refused shape is repaired in every sync and then sent like any other unsent change. Brews pass no `toRecord`. A repair never touches `updated_at`, so it is not an edit and cannot win over a newer server copy, and a record the server holds at an equal `updated_at` is not sent again. The repaired copy reaches localStorage only after a sync whose pull succeeded, or when that record is edited; until then the state hydrated at start keeps the old shape.

Rule for anyone adding a field: every key a record carries must be a column in `supabase/schema-snapshot.sql`, and an empty string must never reach a uuid or timestamp column. Store "none" as `null`: an `undefined` value is dropped by JSON, so the upsert leaves the server's old value in place and a later sync brings it back. A journal's "no rating" is `null` (`Journal.rating` is `number | null`): the empty form starts with `null`, clearing the box sets `null`, and every reader of a rating accepts it. `updatePreset` changes a preset's `teaId` or `teaType` only when the update names that key (the preset's sync button, `onSyncType`, names only `teaType`); a named empty value means none and is stored as `null`.

**Journal ratings.** `JournalForm` enforces its input's `min` 1 / `max` 5 at submit, with no message: a rating typed in that form session is sent as `null` when the box is empty, otherwise rounded and brought to the nearest limit (`formRating`). So the new-journal form always sends `null` or 1 to 5, while an edit that leaves the rating box alone sends the stored rating as it is, and an older out-of-range rating survives it. The edit page (`JournalPage`) saves what the form submits, not its live copy. `JournalItem` draws `starCount(rating)` stars, a whole number from 0 to 5 whatever is stored (NaN and negatives draw none, above 5 draws 5), so no stored value can throw; `null` or no rating draws nothing. A direct `addJournal`, a tab still on older code or a row already on the server can hold any integer; what else a rating may be is undecided.

## Tea photos

Uploaded photos live in the private `teas` storage bucket as `<user id>/<random uuid>.<ext>`. A tea record stores only the file's path, `image_path`, never a link to it.

- **Showing**: `helpers/teaImages.ts` signs links when photos are shown (`useSignedTeaImages`, used by `TeaList` for the teas on screen and by `TeaForm` when editing): one `createSignedUrls` batch, 1 hour per link, kept in module memory for the page session and signed again 5 minutes before expiry while the tea stays shown. Signed links are never written to a record or to localStorage: the record syncs to every device, and the link would die for all of them. Offline or on any failure nothing is signed, the tea shows no picture, and a later call tries again.
- `teaImageSrc()` picks the picture: for a tea with `image_path`, only its signed link (an older record may still hold an expired signed link in `image`, which is ignored); for a tea without one, `image` as stored, an external URL typed in the form.
- **Uploading** (`TeaForm`): an upload sets `image_path` and clears `image`; the signed link `uploadImage()` returns serves only the form's preview. Typing an image URL clears `image_path`.
- **Deleting old files**: `deleteTea` deletes the tea's photo file at once; a failure (offline included) is only logged and the file stays. An edit that replaces or removes the photo deletes the file the edit started from only when it was saved online, the teas sync carrying it resolved `true`, and no record in the store still uses that path (`updateTea` + `deleteUnreferencedTeaImages`); after an offline save or a failed sync the old file is never deleted. For a tea of another account left in this browser the teas sync can resolve `true` without sending the edit, so replacing its photo, like deleting the tea, asks storage to remove that account's file; the `teas` bucket's policies allow a delete only in the user's own folder (not checked live). On submit, `TeaForm` also deletes photos uploaded during that form session that the saved tea does not keep. Cancelling an edit, or leaving the new-tea form unsaved, deletes nothing, so photos uploaded there stay in the bucket.

## Brew timer

- **Time comes from the clock.** An infusion is kept as instants, `run: { startedAt, endsAt }` (`endsAt` is `null` when counting up), never as a tick count. `BrewTimer` computes what it shows from `Date.now()` via `hooks/useNow.ts` (every 250 ms while running, and at once on every visibility change), so a hidden tab or a locked phone shows the right time on return.
- **The running session** (`{ userId, brewId, presetId, run }`) lives in `stores/useBrewSessionStore.ts`, mirrored to localStorage under `'brewSession'`, so it survives leaving the Brews page and a reload. `BrewPage` drops it only when it is over: another account, or its brew deleted or ended; a brew missing from the list for a moment (an older sync landing) keeps it. The store clears it when the signed-in user changes, and `signOut()` removes the key. Starting another brew first records the running infusion on its own brew.
- **Completing a countdown**: `finishRun()` clears the run before it calls `addInfusion`, so an infusion is recorded once; a countdown whose end has passed records its planned time. A module-level timer in the store completes a countdown when its end passes, whether or not the timer is on screen: on time while the page runs timers, otherwise as soon as the page is visible again; `BrewTimer` does the same while mounted. It waits while the brew is missing from the list and records nothing onto a deleted or ended brew. Limits: only `BrewPage` and `BrewTimer` import the store, so it loads with the lazy Brews page chunk, and after a reload on another page an ended countdown is completed only once the Brews page is opened. The only signal is the `toast_infusion_finished` toast: no sound, vibration or notification.
- **Screen wake lock** (`hooks/useWakeLock.ts`): held while a countdown runs and the page is visible, requested again each time the page becomes visible, released when the countdown ends or `BrewTimer` unmounts; none for a count-up. Every failure is ignored.
- **Two tabs**: a `storage` event for `'brewSession'` (or a full clear) loads the other tab's session into this one, and `finishRun()` re-reads localStorage first, so a run another tab already finished or replaced is not recorded again and this tab takes the stored session instead.

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
- `signOut()` removes only **app-owned** localStorage keys (`teas`, `brews`, `presets`, `journals`, `theme`, `brewSession`, and any key that starts with `sb-` or contains `auth-token`). It does **not** call `localStorage.clear()` — that wiped unrelated keys and other tabs' data.

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
- Image upload (in `TeaForm`) validates MIME type + 8 MB cap and re-encodes files over 500 KB (GIFs excepted) at up to 1920px / quality 0.85 JPEG via `helpers/image.ts` (canvas, no deps), keeping the result only when it is smaller. Don't reintroduce raw `uploadImage(file)` without validation. The tea stores only `image_path`: never write the signed link `uploadImage()` returns, or any signed link, into a record (see "Tea photos").
- Error handling in stores is mostly `console.warn`/`console.error` with no UI surfacing. Sync failures are not thrown: `syncData` reports them as `ok: false`, the stores' `syncX()` resolve `false`, and `SyncOnReconnect` shows one toast (`sync_failed_toast`) for a round with any failure. `react-hot-toast` is the toast library (the `<Toaster/>` lives in `App.tsx`).
- `BrewPage` orchestrates 9 brew/preset components in `components/brew/` (`BrewFilters`, `BrewList`, `BrewItem`, `BrewTimer`, `PresetForm`, `PresetList`, `PresetItem`, `PresetEditForm`, `NewSessionForm`). It owns only cross-cutting UI state (the live infusion fields `BrewTimer` reports for `BrewList`, search and filters, which preset is being edited); the running session and its timer live in `useBrewSessionStore` (see "Brew timer"), and form-local state lives inside each child. Mirror that pattern if you split another large page.
- Tests live in `client/src/__tests__/` mirroring the source tree. See the README in that folder for conventions. Vitest globals (`describe`/`it`/`expect`/`vi`) are configured — don't import them.

## Tests (client)

`npm test` runs 16 files under `client/src/__tests__/` in jsdom (`setup.ts` swaps in jsdom's `localStorage` where Node 25+ hides it). The auth, route, brew-session and `BrewPage` tests mock `@/utils/supa` with their own small stubs, `merge.test.ts` and `JournalItem.test.tsx` need none, and the other nine use `support/fakeSupabase.ts`, an in-memory client: rows per table, the query shapes the app uses, the photo storage calls, an optional cap on rows per select (like `max-rows`), chosen reads or writes made to fail, and every call recorded. It checks writes to brews, journals, presets and teas against their columns as `supabase/schema-snapshot.sql` declares them (`TABLES`) and refuses what the server refuses (see "Records the server would reject"); keep `TABLES` in step with the snapshot. Setting `authUid` (off by default; only the other-account test in `sync.test.ts` sets it) also applies the snapshot's owner-only policies: selects and updates see only that user's rows, and an upsert of another user's row, or with another `user_id`, is refused (42501).

- `helpers/merge.test.ts`: last write wins, a tombstone wins, local-only and remote-only rows.
- `helpers/sync.test.ts`: a failed write reports failure, keeps local data and is retried; a failed pull or later page writes nothing; the indicator shows no success when one table failed; a mutation's failed sync raises no unhandled rejection; tombstones only for live server rows, a rejected one kept and resent; the paged pull past a row cap; another account's records never sent (upsert or tombstone), kept as stored, the sync not failed, and a record without `user_id` sent as the signed-in user's.
- `helpers/teaImages.test.ts`: batch signing, reuse, no second request in flight, nothing in localStorage, failure and offline, re-signing before expiry, the `teaImageSrc` rules.
- `stores/useTeasStore.test.ts`: when `updateTea` deletes the old photo file and when it keeps it.
- `stores/useJournalsStore.test.ts`, `stores/useBrewsStore.test.ts`: `toJournalRecord` / `toPresetRecord` on add, edit and stored records, `updated_at` kept, a newer server copy left alone, an out-of-range rating sent as typed and refused, a journal added offline kept with a `null` brew and a whole rating, preset times clamped to the int4 range; `updatePreset` changing `teaId` / `teaType` only when named.
- `stores/useJournalsStore.test.ts`, `stores/useTeasStore.test.ts`: `dateAdded` set when added offline and sent days later, a stored record without it dated by its `updated_at` at sync (one with it kept, one the server already has not re-sent), and an edit dating it by its last write before the edit.
- `stores/useBrewSessionStore.test.ts`: hydration, an infusion recorded once, a countdown longer than a browser timeout can hold, a bad stored value, two tabs.
- `stores/useAuthStore.test.ts`, `components/ProtectedRoute.test.tsx`, `components/PublicRoute.test.tsx`: see "Architecture: auth & access".
- `components/SyncOnReconnect.test.tsx`: one `sync_failed_toast` for a round with rejected writes in several tables, none when every write went through.
- `components/tea/TeaList.test.tsx`: photos through signed links, never `tea.image`; no picture and no throw when signing fails or offline.
- `pages/BrewPage.test.tsx`: the clock-based timer (hidden periods, completion once, Brews page closed, missing or ended brew, count-up), the session across unmount, reload, sign-out (also when the page never loaded), another account, a deleted brew and a second brew started, and the wake lock.
- `pages/JournalPage.test.tsx`: a new journal without a brew is sent with `null`, one with a brew keeps it, a 3.5 rating is saved as a whole number; the form's rating: none saved as `null`, a typed rating rounded and brought into 1 to 5 (new and edit), a stored rating kept when the box is not touched, a cleared rating saved as `null` and not brought back by the next sync.
- `components/journal/JournalItem.test.tsx`: 0 to 5 stars for any stored rating (`null`, NaN, negative, fractional, huge, ±Infinity) without throwing; `null` drawn like no rating.
- `pages/TeaProfilesPage.test.tsx`: a photo saved by path only, the edit preview through its signed link, the old file deleted on remove or replace (also when another device changed the photo meanwhile), nothing deleted on cancel.
