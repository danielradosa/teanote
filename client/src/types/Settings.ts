export interface Settings {
    id: string
    user_id: string
    theme: 'Teanote Default' | 'Teanote Cozy' | 'Teanote Night'
    ai_enabled: boolean
    language: 'en' | 'sk' | 'jp' | 'chinese' | 'korean'
    updated_at: string
    deleted_at?: string | null
}