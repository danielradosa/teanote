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
    name: string
    teaId: string
    infusionsAmount: number
    infusionTimes: number[]
}

// TODO
// rating of brew session after end
// infusion plannedTime will be presets for different tea types
// make a preset library for different tea types - maybeee?!