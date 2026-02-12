export interface Journal {
    type: string
    name: string
    id: string
    user_id?: string
    teaId: string
    brew_preset_id?: string
    title: string
    rating?: number
    image?: string[]
    content: string
    dateAdded?: string
    updated_at: string
    deleted_at?: string | null
}