import { create } from 'zustand'

interface SyncState {
    lastSync: string | null
    isSyncing: boolean
    justSynced: boolean
    startSync: () => void
    finishSync: (success?: boolean) => void
}

export const useSyncStore = create<SyncState>((set) => ({
    lastSync: null,
    isSyncing: false,
    justSynced: false,

    startSync: () => set({ isSyncing: true, justSynced: false }),

    finishSync: (success = true) => {
        if (success) {
            const now = new Date().toISOString()
            set({ isSyncing: false, justSynced: true, lastSync: now })
            setTimeout(() => set({ justSynced: false }), 2000)
        } else {
            set({ isSyncing: false })
        }
    },
}))