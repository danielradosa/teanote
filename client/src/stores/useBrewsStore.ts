import { create } from 'zustand'
import { storage } from '../helpers/storage'
import supabase from '../utils/supa'
import type { Brew, Infusion, Preset } from '../types/Brew'
import { v4 as uuid } from 'uuid'
import { useAuthStore } from './useAuthStore'
import { useSyncStore } from './useSyncStore'
import { mergeRecords } from '../helpers/merge'

interface BrewsState {
    brews: Brew[]
    presets: Preset[]
    lastSync: string | null

    addBrew: (brew: Omit<Brew, 'id' | 'startedAt' | 'finishedAt' | 'infusions' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'>) => void
    updateBrew: (id: string, updates: Partial<Brew>) => void
    deleteBrew: (id: string) => void
    addInfusion: (brewId: string, infusion: Omit<Infusion, 'number'>) => void

    addPreset: (preset: Omit<Preset, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'>) => void
    updatePreset: (id: string, updates: Partial<Preset>) => void
    deletePreset: (id: string) => void

    syncBrews: () => Promise<void>
    syncPresets: () => Promise<void>
}

export const useBrewsStore = create<BrewsState>((set, get) => ({
    brews: storage.get<Brew[]>('brews') || [],
    presets: storage.get<Preset[]>('presets') || [],
    lastSync: null,

    addBrew: (brew) => {
        const { user } = useAuthStore.getState()
        if (!user) return null

        const now = new Date().toISOString()
        const newBrew: Brew = {
            ...brew,
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

    addPreset: (preset) => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const now = new Date().toISOString()
        const newPreset: Preset = {
            ...preset,
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
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const localBrews = storage.get<Brew[]>('brews') || []

            for (const brew of localBrews) {
                await supabase.from('brews').upsert([{ ...brew, user_id: user.id }], { onConflict: 'id' })
            }

            const { data: dbBrews, error } = await supabase
                .from('brews')
                .select('*')
                .eq('user_id', user.id)

            if (error) throw error

            const merged = mergeRecords(localBrews, dbBrews || [])
            storage.set('brews', merged)
            set({ brews: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Sync brews failed:', err)
            finishSync(false)
        }
    },

    syncPresets: async () => {
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const localPresets = storage.get<Preset[]>('presets') || []

            for (const preset of localPresets) {
                await supabase.from('presets').upsert([{ ...preset, user_id: user.id }], { onConflict: 'id' })
            }

            const { data: dbPresets, error } = await supabase
                .from('presets')
                .select('*')
                .eq('user_id', user.id)

            if (error) throw error

            const merged = mergeRecords(localPresets, dbPresets || [])
            storage.set('presets', merged)
            set({ presets: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Sync presets failed:', err)
            finishSync(false)
        }
    },
}))