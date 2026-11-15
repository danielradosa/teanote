import { create } from 'zustand'
import { storage } from '@/helpers/storage'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from '@/stores/useAuthStore'
import { syncData } from '@/helpers/sync'
import type { Tea } from '@/types/Tea'
import { subscribeTable } from '@/helpers/realtime'
import { useSyncStore } from '@/stores/useSyncStore'
import { deleteImage } from '@/helpers/upload'
import { deleteUnreferencedTeaImages } from '@/helpers/teaImages'
import { toTeaRecord } from '@/helpers/records'

interface TeasState {
    teas: Tea[]
    lastSync: string | null
    addTea: (tea: Omit<Tea, 'id' | 'user_id' | 'updated_at' | 'deleted_at'>) => void
    /**
     * `baseImagePath` is the photo path the edit started from (an edit form's
     * snapshot); without it, the store's current copy. Only that photo is
     * deleted, and only when the saved tea no longer uses it.
     */
    updateTea: (id: string, updates: Partial<Tea>, baseImagePath?: string | null) => void
    deleteTea: (id: string) => void
    /** Resolves true when the teas synced; never rejects. */
    syncTeas: () => Promise<boolean>
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
            dateAdded: now,
            updated_at: now,
            deleted_at: null,
        }

        const updated = [...get().teas, newTea]
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    updateTea: (id, updates, baseImagePath) => {
        const now = new Date().toISOString()
        // A sync may have changed the store's copy while an edit form was open.
        const previousPath = baseImagePath !== undefined
            ? baseImagePath
            : get().teas.find(t => t.id === id)?.image_path
        // A tea stored without dateAdded is dated by its last write, not by this edit.
        const updated = get().teas.map(t =>
            t.id === id ? { ...toTeaRecord(t), ...updates, updated_at: now } : t
        )
        storage.set('teas', updated)
        set({ teas: updated })

        const nextPath = updated.find(t => t.id === id)?.image_path
        const replacedPath = previousPath && previousPath !== nextPath ? previousPath : null

        if (navigator.onLine) {
            void get().syncTeas().then(synced => {
                // Delete a replaced or removed photo only once the server copy of the
                // tea no longer points at it, and never while any record still does.
                if (synced && replacedPath) {
                    return deleteUnreferencedTeaImages([replacedPath], get().teas)
                }
            })
        }
    },

    deleteTea: async (id: string) => {
        const now = new Date().toISOString()

        const tea = get().teas.find(t => t.id === id)
        if (!tea) return

        try {
            if (tea.image_path) {
                await deleteImage('teas', tea.image_path)
            }
        } catch (err) {
            console.error('Failed to delete image:', err)
        }

        const updated = get().teas.map(t =>
            t.id === id ? { ...t, deleted_at: now, updated_at: now } : t
        )
        storage.set('teas', updated)
        set({ teas: updated })

        if (navigator.onLine) get().syncTeas()
    },

    syncTeas: async () => {
        const { records, ok } = await syncData<Tea>('teas', 'teas', toTeaRecord)
        if (records) set({ teas: records })
        if (ok) set({ lastSync: new Date().toISOString() })
        return ok
    },

    initRealtime: () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const { startSync, finishSync } = useSyncStore.getState()

        const unsubscribe = subscribeTable<Tea>('teas', user.id, async (updatedTea) => {
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
