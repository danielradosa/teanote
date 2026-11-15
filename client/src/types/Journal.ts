export interface Journal {
    id: string
    user_id?: string
    teaId: string
    /** The linked brew's id; null when none. Never '': the column is a uuid (see toJournalRecord). */
    brew_preset_id?: string | null
    title: string
    /** null when none, never undefined: JSON drops undefined, so an upsert would leave the server's old rating in place. */
    rating?: number | null
    images?: string[]
    content: string
    dateAdded?: string
    updated_at: string
    deleted_at?: string | null
}