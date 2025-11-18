import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { syncData } from '../helpers/sync'
import type { Brew, Infusion, Preset } from '../types/Brew'
import { useTeasStore } from './useTeasStore'
import { subscribeTable } from '../helpers/realtime'
import { useSyncStore } from './useSyncStore'

interface BrewsState {
    brews: Brew[]
    presets: Preset[]
    lastSync: string | null

    addBrew: (
        b: Omit<
            Brew,
            'id' | 'startedAt' | 'finishedAt' | 'infusions' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'
        > & { presetId?: string }
    ) => string | void
    updateBrew: (id: string, updates: Partial<Brew>) => void
    deleteBrew: (id: string) => void
    addInfusion: (brewId: string, infusion: Omit<Infusion, 'number'>) => void

    addPreset: (p: Omit<Preset, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'>) => void
    updatePreset: (id: string, updates: Partial<Preset>) => void
    deletePreset: (id: string) => void

    getBrewName: (id: string) => string

    syncBrews: () => Promise<void>
    syncPresets: () => Promise<void>

    initRealtime: () => void
    stopRealtime: () => void
    brewsRealtimeUnsub?: () => void

    visibleBrews: () => Brew[]
    visiblePresets: () => Preset[]
}

export const useBrewsStore = create<BrewsState>((set, get) => ({
    brews: storage.get<Brew[]>('brews') || [],
    presets: storage.get<Preset[]>('presets') || [],
    lastSync: null,

    addBrew: (b) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const now = new Date().toISOString()
        const newBrew: Brew = {
            ...b,
            id: uuid(),
            user_id: user.id,
            startedAt: now,
            infusions: [],
            created_at: now,
            updated_at: now,
            deleted_at: null,
        }

        const updated = [...get().brews, newBrew]
        storage.set('brews', updated)
        set({ brews: updated })

        if (navigator.onLine) get().syncBrews()
        return newBrew.id
    },

    updateBrew: (id, updates) => {
        const now = new Date().toISOString()
        const updated = get().brews.map(b =>
            b.id === id ? { ...b, ...updates, updated_at: now } : b
        )
        storage.set('brews', updated)
        set({ brews: updated })

        if (navigator.onLine) get().syncBrews()
    },

    deleteBrew: (id) => {
        const now = new Date().toISOString()
        const updated = get().brews.map(b =>
            b.id === id ? { ...b, deleted_at: now, updated_at: now } : b
        )
        storage.set('brews', updated)
        set({ brews: updated })

        if (navigator.onLine) get().syncBrews()
    },

    addInfusion: (brewId, infusion) => {
        const now = new Date().toISOString()
        const updated = get().brews.map(b => {
            if (b.id === brewId) {
                const nextNumber = b.infusions.length + 1
                return {
                    ...b,
                    infusions: [...b.infusions, { ...infusion, number: nextNumber }],
                    updated_at: now,
                }
            }
            return b
        })

        storage.set('brews', updated)
        set({ brews: updated })
        if (navigator.onLine) get().syncBrews()
    },

    addPreset: (p) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const now = new Date().toISOString()
        const newPreset: Preset = {
            ...p,
            id: uuid(),
            user_id: user.id,
            teaId: p.teaId ? p.teaId : null,
            teaType: p.teaType ? p.teaType : null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
        }

        const updated = [...get().presets, newPreset]
        storage.set('presets', updated)
        set({ presets: updated })

        if (navigator.onLine) get().syncPresets()
    },

    updatePreset: (id, updates) => {
        const now = new Date().toISOString()

        const fixedUpdates = {
            ...updates,
            teaId: updates.teaId ? updates.teaId : null,
            teaType: updates.teaType ? updates.teaType : null,
        }

        const updated = get().presets.map(p =>
            p.id === id ? { ...p, ...fixedUpdates, updated_at: now } : p
        )

        storage.set('presets', updated)
        set({ presets: updated })

        if (navigator.onLine) get().syncPresets()
    },

    deletePreset: (id) => {
        const now = new Date().toISOString()
        const updated = get().presets.map(p =>
            p.id === id ? { ...p, deleted_at: now, updated_at: now } : p
        )
        storage.set('presets', updated)
        set({ presets: updated })

        if (navigator.onLine) get().syncPresets()
    },

    getBrewName: (id?: string): string => {
        if (!id) return ''

        const { visibleBrews, visiblePresets } = useBrewsStore.getState()
        const brew = visibleBrews().find(b => b.id === id)
        if (!brew) return ''

        const { visibleTeas } = useTeasStore.getState()
        const tea = visibleTeas().find(t => t.id === brew.teaId)
        const teaName = tea?.name ?? 'unknown tea'

        const preset = visiblePresets().find(p => p.id === brew.presetId)
        const presetName = preset?.name ? ` [${preset.name}]` : ''

        const date = brew.startedAt ? ` – ${new Date(brew.startedAt).toLocaleDateString()}` : ''

        return `${teaName}${presetName}${date}`
    },

    syncBrews: async () => {
        const merged = await syncData<Brew>('brews', 'brews')
        if (merged) set({ brews: merged, lastSync: new Date().toISOString() })
    },

    syncPresets: async () => {
        const merged = await syncData<Preset>('presets', 'presets')
        if (merged) set({ presets: merged, lastSync: new Date().toISOString() })
    },

    initRealtime: () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        let brewsUnsub: () => void
        let presetsUnsub: () => void

        const { startSync, finishSync } = useSyncStore.getState()

        // eslint-disable-next-line prefer-const
        brewsUnsub = subscribeTable<Brew>('brews', user.id, async (updatedBrew) => {
            startSync()
            await new Promise(r => setTimeout(r, 1000))
            set((state) => {
                const exists = state.brews.find(b => b.id === updatedBrew.id)
                if (exists) {
                    return { brews: state.brews.map(b => b.id === updatedBrew.id ? updatedBrew : b) }
                } else {
                    return { brews: [...state.brews, updatedBrew] }
                }
            })
            finishSync(true)
        })
        // eslint-disable-next-line prefer-const
        presetsUnsub = subscribeTable<Preset>('presets', user.id, async (updatedPreset) => {
            startSync()
            set((state) => {
                const exists = state.presets.find(p => p.id === updatedPreset.id)
                if (exists) {
                    return { presets: state.presets.map(p => p.id === updatedPreset.id ? updatedPreset : p) }
                } else {
                    return { presets: [...state.presets, updatedPreset] }
                }
            })
            await new Promise(r => setTimeout(r, 1000))
            finishSync(true)
        })
        set({
            brewsRealtimeUnsub: () => {
                brewsUnsub?.()
                presetsUnsub?.()
            }
        })
    },

    stopRealtime: () => {
        const unsub = get().brewsRealtimeUnsub
        if (unsub) unsub()
        set({ brewsRealtimeUnsub: undefined })
    },

    visibleBrews: () => get().brews.filter(b => !b.deleted_at),
    visiblePresets: () => get().presets.filter(p => !p.deleted_at),
}))