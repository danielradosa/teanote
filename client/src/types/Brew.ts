export interface Infusion {
    number: number
    actualTime: number
}

export interface Brew {
    id: string
    teaId: string
    journalId?: string
    startedAt: string
    finishedAt?: Date
    infusions: Infusion[]
    notes?: string
    rating?: number
    created_at?: string
    updated_at?: string
    user_id?: string
    deleted_at?: string | null
}

export interface Preset {
    id: string
    name: string
    teaId?: string
    teaType?: string
    infusionsAmount: number
    infusionTimes: number[]
    created_at?: string
    updated_at?: string
    user_id?: string
    deleted_at?: string | null
}