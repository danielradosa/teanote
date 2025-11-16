import { create } from 'zustand'
import supabase from '../utils/supa'
import { useAuthStore } from './useAuthStore'
import type { Settings } from '../types/Settings'
import { useSyncStore } from './useSyncStore'

interface SettingsState {
    settings: Settings | null
    loading: boolean
    loadSettings: () => Promise<void>
    updateSettings: (updates: Partial<Omit<Settings, 'id' | 'user_id'>>) => Promise<void>
    toggleAI: () => Promise<void>
    setTheme: (theme: Settings['theme']) => Promise<void>
    setLanguage: (language: Settings['language']) => Promise<void>
    syncSettings: () => void
    initRealtime: () => void
    stopRealtime: () => void
    settingsRealtimeUnsub?: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: null,
    loading: false,

    loadSettings: async () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        set({ loading: true })

        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle()

        if (error) {
            console.error('Error loading settings:', error)
            set({ loading: false })
            return
        }

        if (!data) {
            const { data: newData, error: insertError } = await supabase
                .from('settings')
                .insert({
                    user_id: user.id,
                    theme: 'Teanote Default',
                    ai_enabled: false,
                    language: 'en'
                })
                .select()
                .single()

            if (insertError) console.error('Error creating default settings:', insertError)
            else set({ settings: newData })
        } else {
            set({ settings: data })
        }

        set({ loading: false })
    },

    updateSettings: async (updates) => {
        const s = get().settings
        if (!s) return

        const { data, error } = await supabase
            .from('settings')
            .update(updates)
            .eq('id', s.id)
            .select()
            .single()

        if (error) console.error('Error updating settings:', error)
        else set({ settings: data })
    },

    toggleAI: async () => {
        const s = get().settings
        if (!s) return
        await get().updateSettings({ ai_enabled: !s.ai_enabled })
    },

    setTheme: async (theme) => {
        await get().updateSettings({ theme })
    },

    setLanguage: async (language) => {
        await get().updateSettings({ language })
    },

    syncSettings: async () => {
        await get().loadSettings()
    },

    initRealtime: () => {
        const { user } = useAuthStore.getState()
        if (!user) return

        const { startSync, finishSync } = useSyncStore.getState()

        const sub = supabase
            .channel(`public:settings_user_${user.id}`)
            // @ts-expect-error typescript doesn't know 'postgres_changes'
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'settings',
                filter: `user_id=eq.${user.id}`
            }, async (payload: { new: Settings }) => {
                startSync()
                set({ settings: payload.new })
                await new Promise(r => setTimeout(r, 1000))
                finishSync(true)
            })
            .subscribe()

        set({ settingsRealtimeUnsub: () => supabase.removeChannel(sub) })
    },

    stopRealtime: () => {
        get().settingsRealtimeUnsub?.()
    }
}))