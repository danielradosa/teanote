import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const PORT = Number(process.env.PORT) || 8080
const MODEL = 'claude-opus-5-5'
const MAX_TOKENS = 4096 // adaptive thinking + two short sections
const ATTEMPT_TIMEOUT_MS = 30_000 // per HTTP attempt
const REQUEST_DEADLINE_MS = 60_000 // whole call, retry and any retry-after wait included

function requireEnv(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`Missing required env var: ${name}`)
    return v
}

const ANTHROPIC_API_KEY = requireEnv('ANTHROPIC_API_KEY')
const SUPABASE_URL = requireEnv('SUPABASE_URL')
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY')
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*'

// --- types ----------------------------------------------------------------

interface DashboardInsights {
    profile: string[]
    patterns: string[]
}

interface DashboardInput {
    language?: string
    teas?: {
        total?: number
        byType?: Record<string, number>
        recentlyAdded?: Array<{ name?: string; type?: string }>
    }
    brews?: {
        totalLast30Days?: number
        totalAllTime?: number
        mostBrewedTea?: { name?: string; count?: number } | null
        averageInfusionsPerSession?: number
    }
    journals?: {
        total?: number
        averageRating?: number | null
        recentTitles?: string[]
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        supabase?: SupabaseClient
        userId?: string
    }
}

// --- auth middleware ------------------------------------------------------

async function requireAuthorizedUser(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header('authorization')
        if (!authHeader) {
            res.status(401).json({ error: 'missing authorization' })
            return
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        })

        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userData.user) {
            res.status(401).json({ error: 'invalid session' })
            return
        }

        req.supabase = supabase
        req.userId = userData.user.id
        next()
    } catch (err) {
        next(err)
    }
}

// --- helpers --------------------------------------------------------------

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
    timeout: ATTEMPT_TIMEOUT_MS,
    maxRetries: 1,
})

// Structured outputs accept no minItems/maxItems/minLength/maxLength, so the
// 1-4 items and 1-1000 characters limits live in isValidInsights() only.
const INSIGHTS_SCHEMA = {
    type: 'object',
    properties: {
        profile: { type: 'array', items: { type: 'string' } },
        patterns: { type: 'array', items: { type: 'string' } },
    },
    required: ['profile', 'patterns'],
    additionalProperties: false,
}

type ClaudeResult =
    | { kind: 'ok'; value: unknown }
    | { kind: 'refusal' }
    | { kind: 'max_tokens' }

async function callClaude(systemPrompt: string, userPrompt: string): Promise<ClaudeResult> {
    let response: Anthropic.Beta.BetaMessage
    try {
        response = await anthropic.beta.messages.create(
            {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                // Thinking is always on for this model and sampling parameters
                // are rejected, so effort is the only control sent.
                output_config: {
                    effort: 'low',
                    format: { type: 'json_schema', schema: INSIGHTS_SCHEMA },
                },
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
            },
            { signal: AbortSignal.timeout(REQUEST_DEADLINE_MS) },
        )
    } catch (err) {
        logAnthropicError(err)
        throw new Error('AI provider request failed')
    }

    if (response.stop_reason === 'refusal') {
        console.warn('Anthropic refusal, category:', response.stop_details?.category ?? 'none')
        return { kind: 'refusal' }
    }
    if (response.stop_reason === 'max_tokens') {
        console.warn(`Anthropic response hit max_tokens (${MAX_TOKENS})`)
        return { kind: 'max_tokens' }
    }
    if ((response.usage.iterations ?? []).some((it) => it.type === 'fallback_message')) {
        console.info('Anthropic fallback model served the insights:', response.model)
    }

    // Thinking blocks are ignored. Text before a fallback block belongs to a
    // model that declined, so only text after the last switch point counts.
    let text = ''
    for (const block of response.content) {
        if (block.type === 'fallback') text = ''
        else if (block.type === 'text') text += block.text
    }

    try {
        return { kind: 'ok', value: JSON.parse(text) }
    } catch {
        return { kind: 'ok', value: null }
    }
}

// TypeScript SDK: APIConnectionError and APIUserAbortError are subclasses of
// APIError, so they are checked before it. No branch logs the key or the prompt.
function logAnthropicError(err: unknown): void {
    if (err instanceof Anthropic.AuthenticationError) {
        console.error(`Anthropic authentication failed (401, request ${err.requestID ?? 'n/a'}): check ANTHROPIC_API_KEY`)
    } else if (err instanceof Anthropic.RateLimitError) {
        console.error(`Anthropic rate limit hit (429, request ${err.requestID ?? 'n/a'})`)
    } else if (err instanceof Anthropic.APIUserAbortError) {
        console.error(`Anthropic call abandoned at the ${REQUEST_DEADLINE_MS} ms deadline`)
    } else if (err instanceof Anthropic.APIConnectionTimeoutError) {
        console.error(`Anthropic request timed out after ${ATTEMPT_TIMEOUT_MS} ms per attempt`)
    } else if (err instanceof Anthropic.APIConnectionError) {
        console.error('Anthropic connection error:', err.message)
    } else if (err instanceof Anthropic.APIError) {
        console.error(`Anthropic API error (${err.status ?? 'n/a'} ${err.type ?? 'unknown'}, request ${err.requestID ?? 'n/a'}): ${err.message}`)
    } else {
        console.error('Anthropic call failed:', err instanceof Error ? err.message : String(err))
    }
}

const VALID_LANGUAGES = new Set(['en', 'sk', 'ja', 'zh', 'ko'])
const LANGUAGE_LABELS: Record<string, string> = {
    en: 'English',
    sk: 'Slovak',
    ja: 'Japanese',
    zh: 'Mandarin Chinese',
    ko: 'Korean',
}

function safeLanguage(raw: unknown): string {
    const v = typeof raw === 'string' ? raw.toLowerCase() : 'en'
    return VALID_LANGUAGES.has(v) ? v : 'en'
}

function isValidParagraphList(value: unknown): value is string[] {
    if (!Array.isArray(value)) return false
    if (value.length < 1 || value.length > 4) return false
    return value.every(p => typeof p === 'string' && p.length > 0 && p.length <= 1000)
}

function isValidInsights(value: unknown): value is DashboardInsights {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    return isValidParagraphList(v.profile) && isValidParagraphList(v.patterns)
}

const STYLE_ANGLES = [
    'pick something concrete to call out',
    'open with a small observation about variety',
    'lead with their most-brewed tea',
    'comment on recency or rhythm',
    'note balance or imbalance across types',
    'mention a gap or invitation to explore',
    'highlight ratings as a thread',
    'frame it as a tea-keeper noticing a pattern',
]

// --- per-user model budget ------------------------------------------------

// Any signed-in account may reach the paid model, so each account gets a fixed
// number of model calls per window. Over it, the account's last good result in
// the window is repeated, or 429 when there is none. In memory, per process.
const AI_CALLS_PER_WINDOW = 10
const AI_WINDOW_MS = 60 * 60 * 1000

interface AiBudget {
    windowStart: number
    calls: number
    last: DashboardInsights | null
}

const aiBudgets = new Map<string, AiBudget>()

function aiBudgetFor(userId: string): AiBudget {
    const now = Date.now()
    let budget = aiBudgets.get(userId)
    if (!budget || now - budget.windowStart >= AI_WINDOW_MS) {
        budget = { windowStart: now, calls: 0, last: null }
        aiBudgets.set(userId, budget)
    }
    return budget
}

// Drop closed windows so the map does not grow with every account ever seen.
setInterval(() => {
    const now = Date.now()
    for (const [userId, budget] of aiBudgets) {
        if (now - budget.windowStart >= AI_WINDOW_MS) aiBudgets.delete(userId)
    }
}, AI_WINDOW_MS).unref()

// --- app ------------------------------------------------------------------

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '16kb' }))

app.get('/healthz', (_req, res) => {
    res.json({ ok: true })
})

app.post('/ai-dashboard-insights', requireAuthorizedUser, async (req, res, next) => {
    try {
        // Before the budget and the model: a malformed body costs nothing.
        const shapeError = bodyShapeError(req.body)
        if (shapeError) {
            res.status(400).json({ error: `invalid request body: ${shapeError}` })
            return
        }
        const body = req.body as DashboardInput
        const language = safeLanguage(body.language)
        const langLabel = LANGUAGE_LABELS[language] ?? 'English'

        const summary = {
            teas: {
                total: clampInt(body.teas?.total, 0, 10000),
                byType: sanitizeByType(body.teas?.byType),
                recentlyAdded: sanitizeTeaList(body.teas?.recentlyAdded),
            },
            brews: {
                totalLast30Days: clampInt(body.brews?.totalLast30Days, 0, 10000),
                totalAllTime: clampInt(body.brews?.totalAllTime, 0, 100000),
                mostBrewedTea: body.brews?.mostBrewedTea
                    ? {
                        name: safeStr(body.brews.mostBrewedTea.name, 200),
                        count: clampInt(body.brews.mostBrewedTea.count, 0, 10000),
                    }
                    : null,
                averageInfusionsPerSession: clampFloat(body.brews?.averageInfusionsPerSession, 0, 50),
            },
            journals: {
                total: clampInt(body.journals?.total, 0, 10000),
                averageRating:
                    typeof body.journals?.averageRating === 'number'
                        ? clampFloat(body.journals.averageRating, 0, 5)
                        : null,
                recentTitles: (body.journals?.recentTitles ?? [])
                    .slice(0, 5)
                    .map((t) => safeStr(t, 200))
                    .filter(Boolean),
            },
        }

        const totalActivity =
            summary.teas.total + summary.brews.totalAllTime + summary.journals.total
        if (totalActivity === 0) {
            res.json({
                profile: [
                    'No teas in your collection yet.',
                    'Add a tea on the Teas page to start building your library.',
                ],
                patterns: [
                    'No brews or journal entries yet.',
                    'Start a session on the Brews page when you sit down with a cup.',
                ],
            } satisfies DashboardInsights)
            return
        }

        if (!req.userId) throw new Error('requireAuthorizedUser did not set userId')
        // Checked and counted before any await, so parallel requests can't overshoot.
        const budget = aiBudgetFor(req.userId)
        if (budget.calls >= AI_CALLS_PER_WINDOW) {
            if (budget.last) {
                res.json(budget.last)
            } else {
                const retryAfterMs = budget.windowStart + AI_WINDOW_MS - Date.now()
                res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))))
                res.status(429).json({ error: 'AI request limit reached, try again later' })
            }
            return
        }
        budget.calls += 1

        const angle = STYLE_ANGLES[Math.floor(Math.random() * STYLE_ANGLES.length)]
        const nonce = Math.random().toString(36).slice(2, 8)

        const systemPrompt =
            `You are writing a friendly, personalized dashboard overview for a tea-journal user. ` +
            `Write in ${langLabel}. Be warm but specific — reference their actual data with names and numbers. ` +
            `Avoid platitudes and generic tea-blogger language. No headings, no bullets, plain prose. ` +
            `Vary your phrasing and opening each time you write — never repeat the same lead sentence. ` +
            `"profile" and "patterns" each contain exactly 2 short paragraphs (1-2 sentences each), one paragraph per array item. ` +
            `"profile" is about their collection. "patterns" is about their brewing + journaling activity.`

        const userPrompt =
            `User data summary (JSON):\n${JSON.stringify(summary, null, 2)}\n\n` +
            `Style angle for this response: ${angle}.\n` +
            `Request id (use for variety): ${nonce}.\n` +
            `Write the two short paragraphs for each section.`

        const result = await callClaude(systemPrompt, userPrompt)

        if (result.kind === 'refusal') {
            res.status(502).json({ error: 'AI declined the request' })
            return
        }
        if (result.kind === 'max_tokens') {
            res.status(502).json({ error: 'AI response was cut off' })
            return
        }
        if (!isValidInsights(result.value)) {
            res.status(502).json({ error: 'AI returned invalid shape' })
            return
        }

        budget.last = result.value
        res.json(result.value)
    } catch (err) {
        next(err)
    }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // express.json() rejects malformed JSON and, being strict, any top-level
    // value that is not an object or array. Not logged: the error holds the body.
    if ((err as { type?: unknown } | null | undefined)?.type === 'entity.parse.failed') {
        res.status(400).json({ error: 'invalid request body: expected a JSON object' })
        return
    }
    console.error('unhandled error:', err)
    res.status(500).json({ error: 'internal error' })
})

app.listen(PORT, () => {
    console.log(`ai-service listening on :${PORT}`)
})

// --- sanitizers -----------------------------------------------------------

function isJsonObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// A present field of the wrong container kind; absent and null count as empty.
function wrongKind(v: unknown, kind: 'object' | 'array'): boolean {
    if (v === undefined || v === null) return false
    return kind === 'array' ? !Array.isArray(v) : !isJsonObject(v)
}

// Why the body can't be read as a DashboardInput, or null when it can. Only the
// containers are checked: the sanitizers below zero or drop a scalar of the
// wrong type, as before.
function bodyShapeError(body: unknown): string | null {
    if (!isJsonObject(body)) return 'expected a JSON object'
    const { teas, brews, journals } = body
    if (wrongKind(teas, 'object')) return 'teas must be an object'
    if (wrongKind(brews, 'object')) return 'brews must be an object'
    if (wrongKind(journals, 'object')) return 'journals must be an object'
    if (isJsonObject(teas)) {
        if (wrongKind(teas.byType, 'object')) return 'teas.byType must be an object'
        if (wrongKind(teas.recentlyAdded, 'array')) return 'teas.recentlyAdded must be an array'
    }
    if (isJsonObject(brews) && wrongKind(brews.mostBrewedTea, 'object')) {
        return 'brews.mostBrewedTea must be an object'
    }
    if (isJsonObject(journals) && wrongKind(journals.recentTitles, 'array')) {
        return 'journals.recentTitles must be an array'
    }
    return null
}

function safeStr(v: unknown, max: number): string {
    if (typeof v !== 'string') return ''
    return v.trim().slice(0, max)
}

function clampInt(v: unknown, lo: number, hi: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0
    return Math.max(lo, Math.min(hi, Math.floor(v)))
}

function clampFloat(v: unknown, lo: number, hi: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0
    return Math.max(lo, Math.min(hi, v))
}

const BY_TYPE_LIMIT = 20

function sanitizeByType(input: unknown): Record<string, number> {
    if (!input || typeof input !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        const key = safeStr(k, 32)
        const count = clampInt(v, 0, 10000)
        if (key && count > 0) out[key] = count
    }
    const entries = Object.entries(out)
    if (entries.length <= BY_TYPE_LIMIT) return out
    // Keep the largest counts; the sort is stable, so the earlier of two equal
    // counts wins. The kept entries stay in input order.
    const kept = new Set(
        [...entries].sort((a, b) => b[1] - a[1]).slice(0, BY_TYPE_LIMIT).map(([k]) => k),
    )
    return Object.fromEntries(entries.filter(([k]) => kept.has(k)))
}

function sanitizeTeaList(input: unknown): Array<{ name: string; type: string }> {
    if (!Array.isArray(input)) return []
    return input
        .slice(0, 5)
        .map((item) => ({
            name: safeStr((item as { name?: unknown })?.name, 200),
            type: safeStr((item as { type?: unknown })?.type, 32),
        }))
        .filter((t) => t.name)
}
