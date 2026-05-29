import { useAuthStore } from '@/stores/useAuthStore'

export interface PresetSuggestion {
    infusionsAmount: number
    infusionTimes: number[]
    rationale?: string
}

export interface SuggestPresetInput {
    teaName?: string
    teaType?: string
    origin?: string
    year?: string
}

const FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

export async function suggestPreset(input: SuggestPresetInput): Promise<PresetSuggestion> {
    const { session } = useAuthStore.getState()
    if (!session) throw new Error('not authenticated')
    if (!FUNCTION_URL) throw new Error('VITE_SUPABASE_FUNCTIONS_URL not set')

    const res = await fetch(`${FUNCTION_URL}/ai-suggest-preset`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
    })

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `request failed (${res.status})`)
    }

    return res.json() as Promise<PresetSuggestion>
}
