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

    addBrew: (brew: Omit<Brew, 'id' | 'startedAt' | 'finishedAt' | 'infusions' | 'created_at' | 'updated_at' | 'user_id'>) => void
    updateBrew: (id: string, updates: Partial<Brew>) => void
    deleteBrew: (id: string) => void
    addInfusion: (brewId: string, infusion: Omit<Infusion, 'number'>) => void

    addPreset: (preset: Omit<Preset, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => void
    updatePreset: (id: string, updates: Partial<Preset>) => void
    deletePreset: (id: string) => void

    syncBrews: () => Promise<void>
    syncPresets: () => Promise<void>
}

export const useBrewsStore = create<BrewsState>((set, get) => ({
    brews: storage.get<Brew[]>('brews') || [],
    presets: storage.get<Preset[]>('presets') || [],
    lastSync: null,

    addBrew: (brew: { teaId: string; journalId?: string }) => {
        const { user } = useAuthStore.getState()
        if (!user) return null

        const newBrew: Brew = {
            ...brew,
            id: uuid(),
            user_id: user.id,
            startedAt: new Date().toISOString(),
            infusions: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const updated = [...get().brews, newBrew]
        storage.set('brews', updated)
        set({ brews: updated })

        if (navigator.onLine) get().syncBrews()

        return newBrew.id
    },

    updateBrew: (id, updates) => {
        const updated = get().brews.map(b =>
            b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b
        )
        storage.set('brews', updated)
        set({ brews: updated })

        if (navigator.onLine) get().syncBrews()
    },

    deleteBrew: async (id) => {
        const updated = get().brews.filter(b => b.id !== id)
        storage.set('brews', updated)
        set({ brews: updated })

        const { user } = useAuthStore.getState()
        if (!user || !navigator.onLine) return

        const { error } = await supabase.from('brews').delete().eq('id', id).eq('user_id', user.id)
        if (error) console.error('❌ Failed to delete brew from DB:', error)
        else await get().syncBrews()
    },

    addInfusion: (brewId, infusion) => {
        const updated = get().brews.map(b => {
            if (b.id === brewId) {
                const nextNumber = b.infusions.length + 1
                return {
                    ...b,
                    infusions: [...b.infusions, { ...infusion, number: nextNumber }],
                    updated_at: new Date().toISOString()
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

        const newPreset: Preset = {
            ...preset,
            id: uuid(),
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const updated = [...get().presets, newPreset]
        storage.set('presets', updated)
        set({ presets: updated })

        if (navigator.onLine) get().syncPresets()
    },

    updatePreset: (id, updates) => {
        const updated = get().presets.map(p =>
            p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p
        )
        storage.set('presets', updated)
        set({ presets: updated })

        if (navigator.onLine) get().syncPresets()
    },

    deletePreset: async (id) => {
        const updated = get().presets.filter(p => p.id !== id)
        storage.set('presets', updated)
        set({ presets: updated })

        const { user } = useAuthStore.getState()
        if (!user || !navigator.onLine) return

        const { error } = await supabase.from('presets').delete().eq('id', id).eq('user_id', user.id)
        if (error) console.error('❌ Failed to delete preset from DB:', error)
        else await get().syncPresets()
    },

    syncBrews: async () => {
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const raw = storage.get<unknown>('brews')
            const localBrews = Array.isArray(raw) ? (raw as Brew[]) : []

            for (const brew of localBrews) {
                await supabase.from('brews').upsert([{ ...brew, user_id: user.id }], { onConflict: 'id' })
            }

            const { data: dbBrews, error: fetchError } = await supabase
                .from('brews')
                .select('*')
                .eq('user_id', user.id)

            if (fetchError) {
                console.error('❌ Failed to fetch brews from DB:', fetchError)
                finishSync(false)
                return
            }

            const merged = mergeRecords(localBrews, dbBrews || [])
            storage.set('brews', merged)
            set({ brews: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Unexpected error during syncBrews:', err)
            finishSync(false)
        }
    },

    syncPresets: async () => {
        const { user } = useAuthStore.getState()
        const { startSync, finishSync } = useSyncStore.getState()
        if (!user) return

        startSync()
        try {
            const raw = storage.get<unknown>('presets')
            const localPresets = Array.isArray(raw) ? (raw as Preset[]) : []

            for (const preset of localPresets) {
                await supabase.from('presets').upsert([{ ...preset, user_id: user.id }], { onConflict: 'id' })
            }

            const { data: dbPresets, error: fetchError } = await supabase
                .from('presets')
                .select('*')
                .eq('user_id', user.id)

            if (fetchError) {
                console.error('❌ Failed to fetch presets from DB:', fetchError)
                finishSync(false)
                return
            }

            const merged = mergeRecords(localPresets, dbPresets || [])
            storage.set('presets', merged)
            set({ presets: merged, lastSync: new Date().toISOString() })

            finishSync(true)
        } catch (err) {
            console.error('❌ Unexpected error during syncPresets:', err)
            finishSync(false)
        }
    }
}))