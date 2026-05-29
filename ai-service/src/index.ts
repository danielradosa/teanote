import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import { createClient } from '@supabase/supabase-js'

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

const VALID_TEA_TYPES = new Set([
    'green', 'oolong', 'red', 'white', 'yellow', 'puerh', 'purple', 'any',
])

interface PresetSuggestion {
    infusionsAmount: number
    infusionTimes: number[]
    rationale?: string
}

function isValidSuggestion(value: unknown): value is PresetSuggestion {
    if (!value || typeof value !== 'object') return false
    const v = value as Record<string, unknown>
    if (typeof v.infusionsAmount !== 'number') return false
    if (v.infusionsAmount < 1 || v.infusionsAmount > 15) return false
    if (!Array.isArray(v.infusionTimes)) return false
    if (v.infusionTimes.length !== v.infusionsAmount) return false
    return v.infusionTimes.every(
        (t) => typeof t === 'number' && t > 0 && t <= 600,
    )
}

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '8kb' }))

app.get('/healthz', (_req, res) => {
    res.json({ ok: true })
})

app.post('/ai-suggest-preset', async (req: Request, res: Response, next: NextFunction) => {
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

        const teaName = String(req.body?.teaName ?? '').trim().slice(0, 200)
        const teaTypeRaw = String(req.body?.teaType ?? '').trim().toLowerCase().slice(0, 32)
        const teaType = VALID_TEA_TYPES.has(teaTypeRaw) ? teaTypeRaw : 'any'
        const origin = String(req.body?.origin ?? '').trim().slice(0, 200)
        const year = String(req.body?.year ?? '').trim().slice(0, 16)

        if (!teaName && teaType === 'any') {
            res.status(400).json({ error: 'teaName or teaType required' })
            return
        }

        const userPrompt = [
            `Tea name: ${teaName || '(unknown)'}`,
            `Tea type: ${teaType}`,
            origin ? `Origin: ${origin}` : null,
            year ? `Year: ${year}` : null,
            '',
            'Return a gongfu-style brewing preset for a 100ml gaiwan.',
            'Output JSON only, exact shape:',
            '{"infusionsAmount": number 1-15, "infusionTimes": number[] (seconds, same length as infusionsAmount), "rationale": short string}',
        ].filter(Boolean).join('\n')

        const systemPrompt =
            'You are a tea brewing assistant for gongfu-style infusions. ' +
            'Always reply with valid JSON only — no prose, no markdown. ' +
            'Times are in seconds, between 1 and 600. ' +
            'Typical gongfu has 4-10 infusions starting short (5-15s) and lengthening. ' +
            'Aged puerh and oolong tolerate more infusions than green or yellow tea.'

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
                temperature: 0.4,
                max_tokens: 400,
            }),
        })

        if (!aiRes.ok) {
            const errText = await aiRes.text()
            console.error('Groq error:', aiRes.status, errText)
            res.status(502).json({ error: 'AI request failed' })
            return
        }

        const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> }
        const content = aiJson.choices?.[0]?.message?.content
        if (!content) {
            res.status(502).json({ error: 'empty AI response' })
            return
        }

        let parsed: unknown
        try {
            parsed = JSON.parse(content)
        } catch {
            res.status(502).json({ error: 'AI returned invalid JSON' })
            return
        }

        if (!isValidSuggestion(parsed)) {
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
