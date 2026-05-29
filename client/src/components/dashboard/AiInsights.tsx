import { useEffect, useRef, useState } from 'react'
import { getDashboardInsights, type DashboardInsights } from '@/helpers/ai'
import { useTeasStore } from '@/stores/useTeasStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import Loader from '@/components/Loader'
import { t } from 'i18next'

interface AiInsightsProps {
    slot: 'profile' | 'patterns'
}

// Module-level state so both slots share one fetch per dashboard mount.
let sharedInFlight: Promise<DashboardInsights> | null = null
let sharedResult: DashboardInsights | null = null
let sharedError: string | null = null
const subscribers = new Set<() => void>()

function notify() {
    subscribers.forEach(fn => fn())
}

export default function AiInsights({ slot }: AiInsightsProps) {
    const { visibleTeas } = useTeasStore()
    const { visibleBrews } = useBrewsStore()
    const { visibleJournals } = useJournalsStore()
    const { settings } = useSettingsStore()
    const { user } = useAuthStore()

    const aiEnabled = settings?.ai_enabled ?? false
    const language = settings?.language ?? 'en'

    const [, force] = useState(0)
    const rerender = () => force(n => n + 1)
    const hasFetchedRef = useRef(false)

    useEffect(() => {
        subscribers.add(rerender)
        return () => {
            subscribers.delete(rerender)
        }
    }, [])

    useEffect(() => {
        if (!aiEnabled || !user) return
        if (hasFetchedRef.current) return
        hasFetchedRef.current = true

        if (!sharedInFlight && !sharedResult) {
            sharedError = null
            sharedInFlight = getDashboardInsights({
                language,
                teas: visibleTeas(),
                brews: visibleBrews(),
                journals: visibleJournals(),
            })
            sharedInFlight
                .then(result => {
                    sharedResult = result
                    sharedInFlight = null
                    notify()
                })
                .catch(err => {
                    sharedError = err instanceof Error ? err.message : 'unknown error'
                    sharedInFlight = null
                    console.error('insights failed:', err)
                    notify()
                })
        }
    }, [aiEnabled, user, language, visibleTeas, visibleBrews, visibleJournals])

    const title = slot === 'profile' ? t('dash_ai_profile_title') : t('dash_ai_patterns_title')

    let body: React.ReactNode
    if (!aiEnabled) {
        body = <p className="subtitle">{t('dash_ai_disabled')}</p>
    } else if (sharedInFlight) {
        body = (
            <div className="ai-card-status">
                <Loader size={16} inline color="var(--text-color)" />
                <small className="synced-at">{t('dash_ai_loading')}</small>
            </div>
        )
    } else if (sharedError && !sharedResult) {
        body = <p className="msg error">{t('dash_ai_error')}</p>
    } else {
        const paragraphs = sharedResult ? sharedResult[slot] : []
        body = paragraphs.length > 0
            ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
            : <p className="subtitle">{t('dash_ai_empty')}</p>
    }

    return (
        <>
            <h2>✨ {title}</h2>
            <div className="ai-card-body">{body}</div>
        </>
    )
}
