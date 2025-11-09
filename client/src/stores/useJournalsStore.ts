import { create } from 'zustand'
import { storage } from '../helpers/storage'
import supabase from '../utils/supa'
import type { Journal } from '../types/Journal'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { useSyncStore } from './useSyncStore'
import { mergeRecords } from '../helpers/merge'

interface JournalsState {
    journals: Journal[]
    lastSync: string | null
    addJournal: (journal: Omit<Journal, 'id' | 'dateAdded' | 'user_id'>) => void
    updateJournal: (id: string, updates: Partial<Journal>) => void
    deleteJournal: (id: string) => void
    syncJournals: () => Promise<void>
}

export const useJournalsStore = create<JournalsState>((set, get) => ({
    journals: storage.get<Journal[]>('journals') || [],
    lastSync: null,

    addJournal: (journal) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const newJournal: Journal = {
            ...journal,
            id: uuid(),
            user_id: user.id,
            dateAdded: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const updated = [...get().journals, newJournal]
        storage.set('journals', updated)
        set({ journals: updated })

        if (navigator.onLine) get().syncJournals()
    },

    updateJournal: (id, updates) => {
        const updated = get().journals.map(j =>
            j.id === id ? { ...j, ...updates, updated_at: new Date().toISOString() } : j
        )
        storage.set('journals', updated)
        set({ journals: updated })

        if (navigator.onLine) get().syncJournals()
    },

    deleteJournal: async (id) => {
        const updated = get().journals.filter(j => j.id !== id)
        storage.set('journals', updated)
        set({ journals: updated })

        const { user } = useAuthStore.getState()
        if (!user || !navigator.onLine) return

        const { error } = await supabase.from('journals').delete().eq('id', id).eq('user_id', user.id)
        if (error) console.error('❌ Failed to delete journal from DB:', error)
        else await get().syncJournals()
    },

    syncJournals: async () => {
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const raw = storage.get<unknown>('journals')
            const localJournals = Array.isArray(raw) ? raw as Journal[] : []

            for (const journal of localJournals) {
                await supabase.from('journals').upsert([{ ...journal, user_id: user.id }], { onConflict: 'id' })
            }

            const { data: dbJournals, error: fetchError } = await supabase
                .from('journals')
                .select('*')
                .eq('user_id', user.id)

            if (fetchError) {
                console.error('❌ Failed to fetch journals from DB:', fetchError)
                finishSync(false)
                return
            }

            const merged = mergeRecords(localJournals, dbJournals || [])
            storage.set('journals', merged)
            set({ journals: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Unexpected error during syncJournals:', err)
            finishSync(false)
        }
    }
}))