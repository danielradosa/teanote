import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const PORT = Number(process.env.PORT) || 8080
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function requireEnv(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`Missing required env var: ${name}`)
    return v
}

const GROQ_API_KEY = requireEnv('GROQ_API_KEY')
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

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_subscribed, subscription_end, trial_start')
            .eq('id', userData.user.id)
            .maybeSingle()

        const now = Date.now()
        const subActive =
            !!profile?.is_subscribed &&
            !!profile?.subscription_end &&
            new Date(profile.subscription_end).getTime() > now
        const trialActive =
            !!profile?.trial_start &&
            now - new Date(profile.trial_start).getTime() < 30 * 24 * 60 * 60 * 1000

        if (!subActive && !trialActive) {
            res.status(402).json({ error: 'subscription required' })
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

async function callGroq(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 600,
    temperature = 0.9,
): Promise<unknown> {
    const aiRes = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature,
            max_tokens: maxTokens,
        }),
    })

    if (!aiRes.ok) {
        const errText = await aiRes.text()
        console.error('Groq error:', aiRes.status, errText)
        throw new Error(`groq returned ${aiRes.status}`)
    }

    const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = aiJson.choices?.[0]?.message?.content
    if (!content) throw new Error('empty AI response')

    return JSON.parse(content)
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

        const angle = STYLE_ANGLES[Math.floor(Math.random() * STYLE_ANGLES.length)]
        const nonce = Math.random().toString(36).slice(2, 8)

        const systemPrompt =
            `You are writing a friendly, personalized dashboard overview for a tea-journal user. ` +
            `Write in ${langLabel}. Be warm but specific — reference their actual data with names and numbers. ` +
            `Avoid platitudes and generic tea-blogger language. No headings, no bullets, plain prose. ` +
            `Vary your phrasing and opening each time you write — never repeat the same lead sentence. ` +
            `Output JSON only, exact shape: ` +
            `{"profile": [string, string], "patterns": [string, string]} ` +
            `— each array contains exactly 2 short paragraphs (1-2 sentences each). ` +
            `"profile" is about their collection. "patterns" is about their brewing + journaling activity.`

        const userPrompt =
            `User data summary (JSON):\n${JSON.stringify(summary, null, 2)}\n\n` +
            `Style angle for this response: ${angle}.\n` +
            `Request id (use for variety): ${nonce}.\n` +
            `Write the two short paragraphs for each section.`

        const parsed = await callGroq(systemPrompt, userPrompt, 800, 0.95)

        if (!isValidInsights(parsed)) {
            res.status(502).json({ error: 'AI returned invalid shape' })
            return
        }

        res.json(parsed)
    } catch (err) {
        next(err)
    }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('unhandled error:', err)
    res.status(500).json({ error: 'internal error' })
})

app.listen(PORT, () => {
    console.log(`ai-service listening on :${PORT}`)
})

// --- sanitizers -----------------------------------------------------------

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

function sanitizeByType(input: unknown): Record<string, number> {
    if (!input || typeof input !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        const key = safeStr(k, 32)
        const count = clampInt(v, 0, 10000)
        if (key && count > 0) out[key] = count
    }
    return out
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
