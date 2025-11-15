import { create } from 'zustand'

interface SyncState {
    lastSync: string | null
    isSyncing: boolean
    justSynced: boolean
    activeSyncs: number
    startSync: () => void
    finishSync: (success?: boolean) => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
    lastSync: null,
    isSyncing: false,
    justSynced: false,
    activeSyncs: 0,

    startSync: () => {
        const count = get().activeSyncs + 1
        set({
            activeSyncs: count,
            isSyncing: true,
            justSynced: false
        })
    },

    finishSync: (success = true) => {
        const count = Math.max(get().activeSyncs - 1, 0)

        if (count > 0) {
            return set({ activeSyncs: count })
        }

        if (success) {
            const now = new Date().toISOString()
            set({
                activeSyncs: 0,
                isSyncing: false,
                justSynced: true,
                lastSync: now
            })
            setTimeout(() => set({ justSynced: false }), 2000)
        } else {
            set({
                activeSyncs: 0,
                isSyncing: false
            })
        }
    }
}))