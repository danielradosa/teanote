export interface Journal {
    id: string
    user_id?: string
    teaId: string
    /** The linked brew's id; null when none. Never '': the column is a uuid (see toJournalRecord). */
    brew_preset_id?: string | null
    title: string
    rating?: number
    images?: string[]
    content: string
    dateAdded?: string
    updated_at: string
    deleted_at?: string | null
}