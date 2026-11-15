import { create } from 'zustand'
import supabase from '@/utils/supa'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
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

// supabase-js 2.x keeps the session object itself, as JSON, under
// `sb-<project ref>-auth-token`.
function getCachedSession(): Session | null {
    try {
        const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        const raw = key ? localStorage.getItem(key) : null
        const data = raw ? JSON.parse(raw) : null
        const isSession = typeof data?.access_token === 'string' && typeof data?.user?.id === 'string'
        return isSession ? data : null
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

        // Keep the cached session only when the auth server could not be reached
        // (offline cold start). No session for any other reason means signed out.
        const { data, error } = await supabase.auth.getSession()
        const keptOffline = !data.session && cached !== null && isAuthRetryableFetchError(error)
        const session = data.session ?? (keptOffline ? cached : null)
        set({ user: session?.user ?? null, session })

        supabase.auth.onAuthStateChange((event, newSession) => {
            // auth-js reports that same failed refresh as an INITIAL_SESSION
            // without a session; it must not sign out the user kept above.
            if (keptOffline && event === 'INITIAL_SESSION' && !newSession) return
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
        const appKeys = ['teas', 'brews', 'presets', 'journals', 'theme', 'brewSession']
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
