export interface Tea {
    id: string
    name: string
    type: 'green' | 'purple' | 'red' | 'white' | 'yellow' | 'puerh' | 'oolong'
    origin?: string
    year?: string
    vendor?: string
    notes?: string
    image?: string
    link?: string
    dateAdded: string
}