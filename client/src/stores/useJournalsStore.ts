import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { syncData } from '../helpers/sync'
import type { Journal } from '../types/Journal'
import { subscribeTable } from '../helpers/realtime'
import { useSyncStore } from './useSyncStore'

interface JournalsState {
    journals: Journal[]
    lastSync: string | null
    addJournal: (j: Omit<Journal, 'id' | 'user_id' | 'updated_at' | 'deleted_at'>) => void
    updateJournal: (id: string, updates: Partial<Journal>) => void
    deleteJournal: (id: string) => void
    syncJournals: () => Promise<void>
    visibleJournals: () => Journal[]
    initRealtime: () => void
    stopRealtime: () => void
    journalsRealtimeUnsub?: () => void
}

export const useJournalsStore = create<JournalsState>((set, get) => ({
    journals: storage.get<Journal[]>('journals') || [],
    lastSync: null,

    addJournal: (j) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const now = new Date().toISOString()
        const newJournal: Journal = {
            ...j,
            id: uuid(),
            user_id: user.id,
            updated_at: now,
            deleted_at: null,
        }

        const updated = [...get().journals, newJournal]
        storage.set('journals', updated)
        set({ journals: updated })

        if (navigator.onLine) get().syncJournals()
    },

    updateJournal: (id, updates) => {
        const now = new Date().toISOString()
        const updated = get().journals.map(j =>
            j.id === id ? { ...j, ...updates, updated_at: now } : j
        )
        storage.set('journals', updated)
        set({ journals: updated })

        if (navigator.onLine) get().syncJournals()
    },

    deleteJournal: (id) => {
        const now = new Date().toISOString()
        const updated = get().journals.map(j =>
            j.id === id ? { ...j, deleted_at: now, updated_at: now } : j
        )
        storage.set('journals', updated)
        set({ journals: updated })

        if (navigator.onLine) get().syncJournals()
    },

    syncJournals: async () => {
        const merged = await syncData<Journal>('journals', 'journals')
        if (merged) set({ journals: merged, lastSync: new Date().toISOString() })
    },

    initRealtime: () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const { startSync, finishSync } = useSyncStore.getState()

        const unsubscribe = subscribeTable<Journal>('journals', user.id, async(updatedJournal) => {
            startSync()
            set((state) => {
                const exists = state.journals.find(j => j.id === updatedJournal.id)
                if (exists) {
                    return { journals: state.journals.map(j => j.id === updatedJournal.id ? updatedJournal : j) }
                } else {
                    return { journals: [...state.journals, updatedJournal] }
                }
            })
            await new Promise(r => setTimeout(r, 1000))
            finishSync(true)
        })

        set({ journalsRealtimeUnsub: unsubscribe })
    },

    stopRealtime: () => {
        const unsub = get().journalsRealtimeUnsub
        if (unsub) unsub()
        set({ journalsRealtimeUnsub: undefined })
    },

    visibleJournals: () => get().journals.filter(j => !j.deleted_at),
}))