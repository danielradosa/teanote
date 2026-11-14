# ai-service

Tiny Node/Express service that proxies Teanote's AI calls to the Anthropic
API (Claude Opus 5.5, `claude-opus-5-5`, through the official
`@anthropic-ai/sdk`). Deployed on Railway. Verifies the caller's Supabase JWT
before calling the model, then validates the JSON shape coming back.

## Endpoints

- `GET /healthz` — liveness probe.
- `POST /ai-dashboard-insights` — personalized dashboard overview. Returns
  `{ profile: string[], patterns: string[] }` (1-4 short paragraphs each).
  Answers 400 when the body is not a JSON object or one of its objects or
  lists (`teas`, `brews`, `journals`, `teas.byType`, `teas.recentlyAdded`,
  `brews.mostBrewedTea`, `journals.recentTitles`) has the wrong type, before
  anything counts against the limit; 401 without a valid Supabase session;
  502 when the model declines, runs out of tokens or returns an invalid shape;
  429 (with `Retry-After`) when the account is over its model-call limit and
  has no earlier result to repeat; and 500 on any other failure.

## Per-user limit

Every signed-in account can reach the paid model, so each account gets 10 model
calls per hour (`AI_CALLS_PER_WINDOW` / `AI_WINDOW_MS` in `src/index.ts`). A
request with no tea, brew or journal data gets the fixed empty-state text and
does not count. Over the limit, the account's last good result from the current
hour is returned again with 200; with none, the answer is 429. Calls are counted
before the model is called, so parallel requests can't exceed the limit, and
calls that fail still count. The counters live in memory in one process: a
restart resets them and each replica would keep its own.

## Model call

- Effort `low` through `output_config.effort`; thinking is always on for this
  model, and `temperature` / `top_p` / `top_k` are not sent (the model rejects
  them).
- Structured outputs (`output_config.format`, JSON schema) fix the
  `{ profile, patterns }` shape; `isValidInsights()` still checks item counts
  and lengths, which structured outputs can't express.
- Server-side refusal fallback on (`fallbacks: "default"`, beta
  `server-side-fallback-2026-07-01`): a request declined by the safety
  classifiers is re-run on the model Anthropic recommends for that category.
- Bounded: `max_tokens` 4096, 30 s per HTTP attempt, 1 retry, 60 s for the
  whole call.

## Env vars

| Name | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | secret on Railway; the service refuses to start without it |
| `SUPABASE_URL` | yes | same as client |
| `SUPABASE_ANON_KEY` | yes | same as client |
| `PORT` | no | Railway sets this |
| `CORS_ORIGIN` | no | defaults to `*`; set to `https://app.teanote.xyz` in prod |

## Local dev

`npm run dev` is plain `tsx watch src/index.ts` and does not load a `.env` file, so run it through
the Railway CLI, which injects the service's variables into the local process:

```sh
npm install
railway run --service ai-service -- npm run dev
```

These are the deployed service's real values, so a local model call is billed to the same
Anthropic key. The service listens on 8080 locally.

## Deploy

`railway up` from this directory, or push to the connected branch.
