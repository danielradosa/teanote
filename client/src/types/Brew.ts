export interface Brew {
    id: string
    teaId: string
    journalId?: string
    startedAt: Date
    finishedAt?: Date
    infusions: Infusion[]
    notes?: string
    rating?: number
}

export interface Infusion {
    number: number
    actualTime: number
}

export interface Preset {
    id: string
    name: string
    teaId?: string
    teaType?: string
    infusionsAmount: number
    infusionTimes: number[]
}