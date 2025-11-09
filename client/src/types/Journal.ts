export interface Journal {
    id: string
    user_id: string
    teaId: string
    brewPresetId?: string
    title: string
    rating?: number
    content: string
    dateAdded: string
}