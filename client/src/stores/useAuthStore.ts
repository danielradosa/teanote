import { create } from 'zustand'
import supabase from '@/utils/supa'
import type { User, Session, AuthError } from '@supabase/supabase-js'

interface AuthState {
    user: User | null
    session: Session | null
    initialized: boolean
    loading: boolean
    initAuth: () => Promise<void>
    signUp: (email: string, password: string) => Promise<AuthError | null>
    signIn: (email: string, password: string) => Promise<AuthError | null>
    signInWithProvider: (provider: 'google' | 'apple') => Promise<AuthError | null>
    signOut: () => Promise<void>
}

function getCachedSession(): Session | null {
    try {
        const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
        const raw = key ? localStorage.getItem(key) : null
        const data = raw ? JSON.parse(raw) : null
        return data?.currentSession ?? null
    } catch {
        return null
    }
}

export const useAuthStore = create<AuthState>((set) => ({
    user: getCachedSession()?.user ?? null,
    session: getCachedSession(),
    initialized: false,
    loading: !getCachedSession(),

    initAuth: async () => {
        const cached = getCachedSession()
        set({
            user: cached?.user ?? null,
            session: cached ?? null,
            initialized: true,
            loading: false,
        })

        const { data } = await supabase.auth.getSession()
        const session = data.session ?? cached
        set({ user: session?.user ?? null, session })

        supabase.auth.onAuthStateChange((_event, newSession) => {
            const user = newSession?.user ?? null
            set({ user, session: newSession })
        })
    },

    signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password })
        return error
    },

    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        const user = data.user
        if (user) {
            set({ user, session: data.session })
            return null
        }
        return error
    },

    signInWithProvider: async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({ provider })
        return error
    },

    signOut: async () => {
        await supabase.auth.signOut()

        // Clear only app-owned keys; leave unrelated localStorage intact.
        const appKeys = ['teas', 'brews', 'presets', 'journals', 'theme']
        for (const key of appKeys) localStorage.removeItem(key)
        for (const key of Object.keys(localStorage)) {
            if (key.includes('auth-token') || key.startsWith('sb-')) {
                localStorage.removeItem(key)
            }
        }

        set({
            user: null,
            session: null,
        })
    }
}))
