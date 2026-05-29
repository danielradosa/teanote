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

1. **`helpers/merge.ts`** — pure function, no IO, drives the entire sync correctness. Already has a sample test.
2. **`helpers/storage.ts`** — thin localStorage wrapper, easy to mock.
3. **Stores (`stores/*`)** — Zustand stores. Test mutations and `visibleX()` selectors. Mock `supabase` via `vi.mock('@/utils/supa', ...)`.
4. **Components** — only test components with non-trivial logic (filtering, conditional rendering). Skip pure presentational ones.

## Mocking Supabase

The Supabase client is imported as a default export from `@/utils/supa`. Mock it once at the top of a test file:

```ts
vi.mock('@/utils/supa', () => ({
    default: {
        from: vi.fn(() => ({ select: vi.fn(), upsert: vi.fn(), update: vi.fn(), eq: vi.fn() })),
        auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
        channel: vi.fn(),
        removeChannel: vi.fn(),
    },
}))
```
