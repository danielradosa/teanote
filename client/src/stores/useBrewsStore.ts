import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { syncData } from '../helpers/sync'
import type { Brew, Infusion, Preset } from '../types/Brew'

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

    syncBrews: () => Promise<void>
    syncPresets: () => Promise<void>

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
        const updated = get().presets.map(p =>
            p.id === id ? { ...p, ...updates, updated_at: now } : p
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

    syncBrews: async () => {
        const merged = await syncData<Brew>('brews', 'brews')
        if (merged) set({ brews: merged, lastSync: new Date().toISOString() })
    },

    syncPresets: async () => {
        const merged = await syncData<Preset>('presets', 'presets')
        if (merged) set({ presets: merged, lastSync: new Date().toISOString() })
    },

    visibleBrews: () => get().brews.filter(b => !b.deleted_at),
    visiblePresets: () => get().presets.filter(p => !p.deleted_at),
}))