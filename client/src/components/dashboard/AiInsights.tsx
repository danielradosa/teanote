import { useCallback, useEffect, useState } from 'react'
import { getDashboardInsights, type DashboardInsights } from '@/helpers/ai'
import { useTeasStore } from '@/stores/useTeasStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import MdDisplay from '@/components/MdDisplay'
import Loader from '@/components/Loader'
import { t } from 'i18next'

const CACHE_KEY = 'dashboard-insights-v1'
const CACHE_TTL_MS = 60 * 60 * 1000

interface Cached {
    userId: string
    fingerprint: string
    generatedAt: number
    insights: DashboardInsights
}

function fingerprint(teaCount: number, brewCount: number, journalCount: number, language: string): string {
    return `${teaCount}|${brewCount}|${journalCount}|${language}`
}

function readCache(): Cached | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        return raw ? (JSON.parse(raw) as Cached) : null
    } catch {
        return null
    }
}

function writeCache(value: Cached) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(value))
    } catch {
        // localStorage might be full or disabled — non-fatal
    }
}

interface AiInsightsProps {
    slot: 'profile' | 'patterns'
}

let inFlight: Promise<DashboardInsights> | null = null
let cachedForRender: DashboardInsights | null = null

export default function AiInsights({ slot }: AiInsightsProps) {
    const { visibleTeas } = useTeasStore()
    const { visibleBrews } = useBrewsStore()
    const { visibleJournals } = useJournalsStore()
    const { settings } = useSettingsStore()
    const { user } = useAuthStore()

    const teas = visibleTeas()
    const brews = visibleBrews()
    const journals = visibleJournals()
    const language = settings?.language ?? 'en'
    const aiEnabled = settings?.ai_enabled ?? false

    const [insights, setInsights] = useState<DashboardInsights | null>(cachedForRender)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fp = fingerprint(teas.length, brews.length, journals.length, language)

    const fetchInsights = useCallback(async (force: boolean) => {
        if (!user) return
        const cached = readCache()
        const cacheValid =
            cached &&
            cached.userId === user.id &&
            cached.fingerprint === fp &&
            Date.now() - cached.generatedAt < CACHE_TTL_MS

        if (!force && cacheValid) {
            cachedForRender = cached.insights
            setInsights(cached.insights)
            return
        }

        setLoading(true)
        setError(null)
        try {
            if (!inFlight) {
                inFlight = getDashboardInsights({ language, teas, brews, journals })
            }
            const result = await inFlight
            cachedForRender = result
            setInsights(result)
            writeCache({
                userId: user.id,
                fingerprint: fp,
                generatedAt: Date.now(),
                insights: result,
            })
        } catch (err) {
            console.error('insights failed:', err)
            setError(err instanceof Error ? err.message : 'unknown error')
        } finally {
            setLoading(false)
            inFlight = null
        }
    }, [user, fp, language, teas, brews, journals])

    useEffect(() => {
        if (!aiEnabled || !user) return
        fetchInsights(false)
    }, [aiEnabled, user, fetchInsights])

    const title = slot === 'profile' ? t('dash_ai_profile_title') : t('dash_ai_patterns_title')

    if (!aiEnabled) {
        return (
            <>
                <h2>✨ {title}</h2>
                <p className="subtitle">{t('dash_ai_disabled')}</p>
            </>
        )
    }

    if (loading && !insights) {
        return (
            <>
                <h2>✨ {title}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <Loader size={16} inline color="var(--text-color)" />
                    <small className="synced-at">{t('dash_ai_loading')}</small>
                </div>
            </>
        )
    }

    if (error && !insights) {
        return (
            <>
                <h2>✨ {title}</h2>
                <p className="msg error">{t('dash_ai_error')}</p>
                <button
                    className="btn btn-dark btn-sync"
                    style={{ marginTop: 8 }}
                    onClick={() => fetchInsights(true)}
                >
                    <i className="bxr bx-refresh-cw-alt" /> {t('dash_ai_retry')}
                </button>
            </>
        )
    }

    const content = insights ? (slot === 'profile' ? insights.profile : insights.patterns) : ''

    return (
        <>
            <h2>
                ✨ {title}
                {slot === 'profile' && (
                    <button
                        className="btn btn-simple btn-sync"
                        onClick={() => fetchInsights(true)}
                        disabled={loading}
                        aria-label={t('dash_ai_refresh')}
                        style={{ marginLeft: 8, fontSize: 13 }}
                    >
                        {loading ? '…' : '↻'}
                    </button>
                )}
            </h2>
            {content ? <MdDisplay content={content} /> : <p className="subtitle">{t('dash_ai_empty')}</p>}
        </>
    )
}
