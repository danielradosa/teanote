import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { syncData } from '../helpers/sync'
import type { Tea } from '../types/Tea'
import { subscribeTable } from '../helpers/realtime'
import { useSyncStore } from './useSyncStore'

interface TeasState {
    teas: Tea[]
    lastSync: string | null
    addTea: (tea: Omit<Tea, 'id' | 'user_id' | 'updated_at' | 'deleted_at'>) => void
    updateTea: (id: string, updates: Partial<Tea>) => void
    deleteTea: (id: string) => void
    syncTeas: () => Promise<void>
    visibleTeas: () => Tea[]
    initRealtime: () => void
    stopRealtime: () => void
    teasRealtimeUnsub?: () => void
}

export const useTeasStore = create<TeasState>((set, get) => ({
    teas: storage.get<Tea[]>('teas') || [],
    lastSync: null,

    addTea: (tea) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const now = new Date().toISOString()
        const newTea: Tea = {
            ...tea,
            id: uuid(),
            user_id: user.id,
            updated_at: now,
            deleted_at: null,
        }

        const updated = [...get().teas, newTea]
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    updateTea: (id, updates) => {
        const now = new Date().toISOString()
        const updated = get().teas.map(t =>
            t.id === id ? { ...t, ...updates, updated_at: now } : t
        )
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    deleteTea: (id) => {
        const now = new Date().toISOString()
        const updated = get().teas.map(t =>
            t.id === id ? { ...t, deleted_at: now, updated_at: now } : t
        )
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    syncTeas: async () => {
        const merged = await syncData<Tea>('teas', 'teas')
        if (merged) set({ teas: merged, lastSync: new Date().toISOString() })
    },

    initRealtime: () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const { startSync, finishSync } = useSyncStore.getState()

        const unsubscribe = subscribeTable<Tea>('teas', user.id, async(updatedTea) => {
            startSync()
            set((state) => {
                const exists = state.teas.find(t => t.id === updatedTea.id)
                if (exists) {
                    return { teas: state.teas.map(t => t.id === updatedTea.id ? updatedTea : t) }
                } else {
                    return { teas: [...state.teas, updatedTea] }
                }
            })
            await new Promise(r => setTimeout(r, 1000))
            finishSync(true)
        })
        set({ teasRealtimeUnsub: unsubscribe })
    },

    stopRealtime: () => {
        const unsub = get().teasRealtimeUnsub
        if (unsub) unsub()
        set({ teasRealtimeUnsub: undefined })
    },

    visibleTeas: () => get().teas.filter(t => !t.deleted_at),
}))