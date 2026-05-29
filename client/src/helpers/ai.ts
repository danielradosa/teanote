import { useAuthStore } from '@/stores/useAuthStore'
import type { Tea } from '@/types/Tea'
import type { Brew } from '@/types/Brew'
import type { Journal } from '@/types/Journal'

export interface DashboardInsights {
    profile: string[]
    patterns: string[]
}

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL

async function postJson<T>(path: string, body: unknown): Promise<T> {
    const { session } = useAuthStore.getState()
    if (!session) throw new Error('not authenticated')
    if (!AI_SERVICE_URL) throw new Error('VITE_AI_SERVICE_URL not set')

    const res = await fetch(`${AI_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `request failed (${res.status})`)
    }

    return res.json() as Promise<T>
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface DashboardSummaryInput {
    language: string
    teas: Tea[]
    brews: Brew[]
    journals: Journal[]
}

function summarize({ language, teas, brews, journals }: DashboardSummaryInput) {
    const now = Date.now()

    const teasByType: Record<string, number> = {}
    for (const tea of teas) teasByType[tea.type] = (teasByType[tea.type] ?? 0) + 1

    const recentTeas = [...teas]
        .sort((a, b) =>
            new Date(b.dateAdded ?? b.updated_at).getTime() -
            new Date(a.dateAdded ?? a.updated_at).getTime()
        )
        .slice(0, 5)
        .map(t => ({ name: t.name, type: t.type }))

    const totalLast30Days = brews.filter(
        b => now - new Date(b.startedAt).getTime() < THIRTY_DAYS_MS
    ).length

    const brewCountByTea = new Map<string, number>()
    for (const b of brews) {
        brewCountByTea.set(b.teaId, (brewCountByTea.get(b.teaId) ?? 0) + 1)
    }
    let mostBrewedTea: { name: string; count: number } | null = null
    let maxCount = 0
    for (const [teaId, count] of brewCountByTea) {
        if (count > maxCount) {
            const tea = teas.find(t => t.id === teaId)
            if (tea) {
                mostBrewedTea = { name: tea.name, count }
                maxCount = count
            }
        }
    }

    const completedBrews = brews.filter(b => b.infusions.length > 0)
    const averageInfusionsPerSession = completedBrews.length
        ? completedBrews.reduce((sum, b) => sum + b.infusions.length, 0) / completedBrews.length
        : 0

    const ratedJournals = journals.filter(j => typeof j.rating === 'number')
    const averageRating = ratedJournals.length
        ? ratedJournals.reduce((sum, j) => sum + (j.rating ?? 0), 0) / ratedJournals.length
        : null

    const recentTitles = [...journals]
        .sort((a, b) =>
            new Date(b.dateAdded ?? b.updated_at).getTime() -
            new Date(a.dateAdded ?? a.updated_at).getTime()
        )
        .slice(0, 5)
        .map(j => j.title)

    return {
        language,
        teas: { total: teas.length, byType: teasByType, recentlyAdded: recentTeas },
        brews: {
            totalLast30Days,
            totalAllTime: brews.length,
            mostBrewedTea,
            averageInfusionsPerSession: Math.round(averageInfusionsPerSession * 10) / 10,
        },
        journals: {
            total: journals.length,
            averageRating: averageRating !== null ? Math.round(averageRating * 10) / 10 : null,
            recentTitles,
        },
    }
}

export async function getDashboardInsights(input: DashboardSummaryInput): Promise<DashboardInsights> {
    return postJson<DashboardInsights>('/ai-dashboard-insights', summarize(input))
}
