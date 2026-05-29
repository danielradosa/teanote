# ai-service

Tiny Node/Express service that proxies Teanote's AI calls to Groq.
Deployed on Railway. Verifies the caller's Supabase JWT and subscription
status before forwarding to Groq, then validates the JSON shape coming
back.

## Endpoints

- `GET /healthz` — liveness probe.
- `POST /ai-suggest-preset` — gongfu brew preset suggestion.

## Env vars

| Name | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | yes | secret on Railway |
| `SUPABASE_URL` | yes | same as client |
| `SUPABASE_ANON_KEY` | yes | same as client |
| `PORT` | no | Railway sets this |
| `CORS_ORIGIN` | no | defaults to `*`; set to `https://app.teanote.xyz` in prod |

## Local dev

```sh
cp .env.example .env  # fill in values
npm install
npm run dev
```

## Deploy

`railway up` from this directory, or push to the connected branch.
