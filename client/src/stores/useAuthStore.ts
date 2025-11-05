import { create } from 'zustand'
import supabase from '../utils/supa'
import type { User, Session, AuthError } from '@supabase/supabase-js'

interface AuthState {
    user: User | null
    session: Session | null
    access: 'unknown' | 'allowed' | 'denied'
    initialized: boolean
    loading: boolean
    trialDaysLeft: number | null
    initAuth: () => Promise<void>
    checkAccess: (userId: string) => Promise<void>
    signUp: (email: string, password: string) => Promise<AuthError | null>
    signIn: (email: string, password: string) => Promise<AuthError | null>
    signInWithProvider: (provider: 'google' | 'apple') => Promise<AuthError | null>
    signOut: () => Promise<void>
}

// Synchronously read session from localStorage for instant initial state
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

export const useAuthStore = create<AuthState>((set, get) => ({
    user: getCachedSession()?.user ?? null,
    session: getCachedSession(),
    access: getCachedSession()?.user ? 'unknown' : 'denied',
    trialDaysLeft: null,
    initialized: false,
    loading: !getCachedSession(),

    initAuth: async () => {
        const cached = getCachedSession()
        set({
            user: cached?.user ?? null,
            session: cached ?? null,
            access: cached?.user ? 'unknown' : 'denied',
            initialized: true,
            loading: false,
        })

        const { data } = await supabase.auth.getSession()
        const session = data.session ?? cached
        set({ user: session?.user ?? null, session })

        if (session?.user) await get().checkAccess(session.user.id)

        supabase.auth.onAuthStateChange((_event, newSession) => {
            const user = newSession?.user ?? null
            set({ user, session: newSession, access: user ? 'unknown' : 'denied' })
            if (user) get().checkAccess(user.id)
        })
    },

    checkAccess: async (userId: string) => {
        if (!userId) return set({ access: 'denied', trialDaysLeft: null })

        const { data, error } = await supabase
            .from('profiles')
            .select('trial_start, subscription_end, is_subscribed')
            .eq('id', userId)
            .maybeSingle()

        if (error || !data) return set({ access: 'denied', trialDaysLeft: null })

        const now = new Date()
        let endDate: Date | null = null
        let daysLeft = 0

        if (data.is_subscribed && data.subscription_end) {
            endDate = new Date(data.subscription_end)
        } else if (data.trial_start) {
            endDate = new Date(data.trial_start)
            endDate.setDate(endDate.getDate() + 30)
        }

        if (endDate) {
            daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            set({
                access: daysLeft > 0 ? 'allowed' : 'denied',
                trialDaysLeft: daysLeft > 0 ? daysLeft : 0,
            })
        } else {
            set({ access: 'denied', trialDaysLeft: 0 })
        }
    },

    signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return error

        const user = data.user
        if (!user) return null

        await get().checkAccess(user.id)
        return null
    },

    signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (!error && get().user) await get().checkAccess(get().user!.id)
        return error
    },

    signInWithProvider: async (provider) => {
        const { error } = await supabase.auth.signInWithOAuth({ provider })
        return error
    },

    signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, session: null, access: 'denied', trialDaysLeft: null })
    },
}))