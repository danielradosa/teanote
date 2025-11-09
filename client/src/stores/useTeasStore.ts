import { create } from 'zustand'
import { storage } from '../helpers/storage'
import supabase from '../utils/supa'
import type { Tea } from '../types/Tea'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { useSyncStore } from './useSyncStore'
import { mergeRecords } from '../helpers/merge'

interface TeasState {
    teas: Tea[]
    lastSync: string | null
    addTea: (tea: Omit<Tea, 'id' | 'dateAdded' | 'user_id'>) => void
    updateTea: (id: string, updates: Partial<Tea>) => void
    deleteTea: (id: string) => void
    syncTeas: () => Promise<void>
}

export const useTeasStore = create<TeasState>((set, get) => ({
    teas: storage.get<Tea[]>('teas') || [],
    lastSync: null,

    addTea: (tea) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const newTea: Tea = {
            ...tea,
            id: uuid(),
            user_id: user.id,
            dateAdded: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        const updated = [...get().teas, newTea]
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    updateTea: (id, updates) => {
        const updated = get().teas.map(t =>
            t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
        )
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    deleteTea: async (id) => {
        const updated = get().teas.filter(t => t.id !== id)
        storage.set('teas', updated)
        set({ teas: updated })

        const { user } = useAuthStore.getState()
        if (!user || !navigator.onLine) return

        const { error } = await supabase.from('teas').delete().eq('id', id).eq('user_id', user.id)
        if (error) console.error('❌ Failed to delete tea from DB:', error)
        else await get().syncTeas()
    },

    syncTeas: async () => {
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const localTeas = storage.get<Tea[]>('teas') || []

            // Push all local items to DB (upsert)
            for (const tea of localTeas) {
                await supabase.from('teas').upsert([{ ...tea, user_id: user.id }], { onConflict: 'id' })
            }

            // Pull everything from DB
            const { data: dbTeas, error: fetchError } = await supabase
                .from('teas')
                .select('*')
                .eq('user_id', user.id)

            if (fetchError) {
                console.error('❌ Failed to fetch teas from DB:', fetchError)
                finishSync(false)
                return
            }

            const merged = mergeRecords(localTeas, dbTeas || [])
            storage.set('teas', merged)
            set({ teas: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Unexpected error during syncTeas:', err)
            finishSync(false)
        }
    }
}))