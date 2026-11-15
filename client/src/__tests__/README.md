# Tests

Vitest + Testing Library. Runs in jsdom.

## Conventions

- **Where:** tests live alongside the code they cover, but inside `src/__tests__/` mirroring the source tree (e.g. `helpers/merge.ts` → `__tests__/helpers/merge.test.ts`). This keeps `src/` itself clean of `.test.*` noise.
- **Naming:** `*.test.ts` for unit tests (pure functions, stores), `*.test.tsx` for component tests.
- **Imports:** use `@/` aliases inside tests — they're configured in `vitest.config.ts` to match the app.
- **Globals:** `describe`, `it`, `expect`, `vi` are global (set via `globals: true`). No imports needed.

## Running

```sh
npm test            # one-shot CI run
npm run test:watch  # watch mode
npm run test:ui     # interactive browser UI
```

## What to test first

Highest leverage, lowest risk:

1. **`helpers/merge.ts`** — pure function, no IO, drives the entire sync correctness. Covered by `helpers/merge.test.ts`; extend that file.
2. **`helpers/storage.ts`** — thin localStorage wrapper, easy to mock.
3. **Stores (`stores/*`)** — Zustand stores. Test mutations and `visibleX()` selectors against the fake Supabase (below).
4. **Components** — only test components with non-trivial logic (filtering, conditional rendering). Skip pure presentational ones.

## Mocking Supabase

The Supabase client is the default export of `@/utils/supa`.

**Anything that reads or writes a table or a photo: use the fake.** `support/fakeSupabase.ts` is an in-memory server (rows per table, the query shapes the app uses, the tea photo storage calls, realtime as a no-op). Wire it up at the top of the file and reset it before each test; it has no `auth`, so sign in through the store:

```ts
import type { User } from '@supabase/supabase-js'
import { fakeSupabase as server } from '@/__tests__/support/fakeSupabase'
import { useAuthStore } from '@/stores/useAuthStore'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

beforeEach(() => {
    server.reset()
    useAuthStore.setState({ user: { id: 'user-1' } as User })
})
```

- **It refuses what the server refuses.** Writes to `brews`, `journals`, `presets` and `teas` are checked against their columns as `supabase/schema-snapshot.sql` declares them (`TABLES`): a key that is not a column, `''` in a uuid or timestamp column, a fraction or an out-of-range number in an integer column, an explicit `null` in a not-null column. Such a write returns the server's error code and stores nothing. When the snapshot changes, change `TABLES` with it.
- **Row-level security is opt-in.** Set `server.authUid` to apply the snapshot's owner-only policies: reads and updates see only that user's rows, and an upsert of another user's row, or with another `user_id`, is refused (42501).
- Seed with `server.seed(table, rows)`; cap rows per select with `server.maxRows`; make chosen reads or writes fail with `server.failRead` / `server.failWrite`; assert on `server.rows(table)`, `server.row(table, id)`, `server.reads` and `server.writes` (refused writes included), and on `files`, `signCalls` and `removeCalls` for photos.
- Like the wire, it drops `undefined` keys, so a missing key keeps the server's value. It does not model column defaults (`dateAdded`, `created_at`), the `updated_at` trigger or an omitted not-null column.

**A small stub is still right** when the test needs no server state or needs control the fake does not give: the auth store and route guard tests stub only `auth` (`useAuthStore.test.ts`: `vi.mock('@/utils/supa', () => ({ default: { auth } }))` with `auth` from `vi.hoisted`), `useBrewSessionStore.test.ts` uses bare `vi.fn`s, and `BrewPage.test.tsx` holds first-page reads back to play a slow network. Pure helpers and components that never reach the client (`merge.test.ts`, `components/journal/JournalItem.test.tsx`) need no mock.
