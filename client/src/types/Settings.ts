export interface Settings {
    id: string
    user_id: string
    theme: 'Teanote Default' | 'Teanote Cozy' | 'Teanote Night' | 'Teanote Sakura'
    ai_enabled: boolean
    language: 'en' | 'sk' | 'ja' | 'zh' | 'ko'
    updated_at: string
    deleted_at?: string | null
}