export interface Tea {
    id: string
    user_id?: string
    name: string
    type: 'green' | 'purple' | 'red' | 'white' | 'yellow' | 'puerh' | 'oolong'
    inventory: string
    origin?: string
    year?: string
    vendor?: string
    notes?: string
    image?: string
    link?: string
    dateAdded?: string
    created_at?: string
    updated_at: string
    deleted_at?: string | null
}