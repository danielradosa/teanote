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
    plannedTime?: number            // Optional: pre-set if wanted
    actualTime: number              // Actual timer (seconds) used
    notes?: string
    rating?: number                 // Optional numeric rating per infusion
}

// 1. rating of brew session will be recommended from averaging rating of infusions
// 2. Infusion plannedTime will be presets for different tea types
// 3. Make a preset library for different tea types 