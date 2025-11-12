export interface Journal {
    id: string
    user_id?: string
    teaId: string
    brew_preset_id?: string
    title: string
    rating?: number
    content: string
    dateAdded?: string
    updated_at: string
    deleted_at?: string | null
}