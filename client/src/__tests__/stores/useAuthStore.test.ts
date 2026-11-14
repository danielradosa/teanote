import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

const auth = vi.hoisted(() => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
}))

vi.mock('@/utils/supa', () => ({ default: { auth } }))

// supabase-js 2.x stores the session under `sb-<project ref>-auth-token`, and
// auth-js `_saveSession` writes the session object itself there as JSON.
const STORAGE_KEY = 'sb-abcdefghijklmnopqrst-auth-token'

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

function makeSession(userId: string, accessToken = `access-${userId}`): Session {
    return {
        access_token: accessToken,
        refresh_token: `refresh-${userId}`,
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
            id: userId,
            aud: 'authenticated',
            role: 'authenticated',
            email: `${userId}@example.com`,
            app_metadata: { provider: 'email', providers: ['email'] },
            user_metadata: {},
            created_at: '2026-01-01T00:00:00Z',
        },
    }
}

function storeSession(session: Session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

// The store reads the cached session when its module loads, so each test
// imports a fresh copy after preparing localStorage.
async function loadStore() {
    vi.resetModules()
    return (await import('@/stores/useAuthStore')).useAuthStore
}

function authListener(): AuthListener {
    const call = auth.onAuthStateChange.mock.calls.at(-1)
    if (!call) throw new Error('initAuth did not subscribe to auth changes')
    return call[0]
}

describe('useAuthStore', () => {
    beforeEach(() => {
        localStorage.clear()
        auth.getSession.mockReset()
        auth.onAuthStateChange.mockReset()
        auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
        auth.signOut.mockReset()
    })

    describe('with a cached session', () => {
        it('reads it into the initial state and the first set(), before getSession settles', async () => {
            const cached = makeSession('user-1')
            storeSession(cached)
            const useAuthStore = await loadStore()

            expect(useAuthStore.getState()).toMatchObject({
                user: { id: 'user-1' },
                session: { access_token: cached.access_token },
                initialized: false,
                loading: false,
            })

            let settleGetSession!: (result: unknown) => void
            auth.getSession.mockReturnValue(new Promise((resolve) => { settleGetSession = resolve }))
            const done = useAuthStore.getState().initAuth()

            expect(useAuthStore.getState()).toMatchObject({
                user: { id: 'user-1' },
                session: { access_token: cached.access_token },
                initialized: true,
                loading: false,
            })

            settleGetSession({ data: { session: cached }, error: null })
            await done
            expect(useAuthStore.getState().user?.id).toBe('user-1')
        })

        it('takes user and session from getSession when it returns one', async () => {
            storeSession(makeSession('user-1', 'cached-token'))
            const useAuthStore = await loadStore()
            const fresh = makeSession('user-1', 'fresh-token')
            auth.getSession.mockResolvedValue({ data: { session: fresh }, error: null })

            await useAuthStore.getState().initAuth()

            expect(useAuthStore.getState().session).toEqual(fresh)
            expect(useAuthStore.getState().user).toEqual(fresh.user)

            const refreshed = makeSession('user-1', 'refreshed-token')
            authListener()('TOKEN_REFRESHED', refreshed)
            expect(useAuthStore.getState().session).toEqual(refreshed)
        })

        it('signs out on a later INITIAL_SESSION without a session when getSession returned one', async () => {
            storeSession(makeSession('user-1', 'cached-token'))
            const useAuthStore = await loadStore()
            const fresh = makeSession('user-1', 'fresh-token')
            auth.getSession.mockResolvedValue({ data: { session: fresh }, error: null })

            await useAuthStore.getState().initAuth()
            expect(useAuthStore.getState().session).toEqual(fresh)

            // Nothing was kept from the cache, so the offline guard must not swallow this.
            authListener()('INITIAL_SESSION', null)

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null })
        })

        it('signs out when getSession resolves with no session and no error', async () => {
            storeSession(makeSession('user-1'))
            const useAuthStore = await loadStore()
            auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

            await useAuthStore.getState().initAuth()

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null })
        })

        it('signs out when the auth server rejects the session', async () => {
            storeSession(makeSession('user-1'))
            const useAuthStore = await loadStore()
            auth.getSession.mockResolvedValue({
                data: { session: null },
                error: new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found'),
            })

            await useAuthStore.getState().initAuth()

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null })
        })

        it('keeps the cached user when getSession cannot reach the auth server', async () => {
            const cached = makeSession('user-1')
            storeSession(cached)
            const useAuthStore = await loadStore()
            auth.getSession.mockResolvedValue({
                data: { session: null },
                error: new AuthRetryableFetchError('Failed to fetch', 0),
            })

            await useAuthStore.getState().initAuth()

            expect(useAuthStore.getState().user?.id).toBe('user-1')
            expect(useAuthStore.getState().session?.access_token).toBe(cached.access_token)

            // auth-js reports the same failed refresh as an INITIAL_SESSION without a session.
            authListener()('INITIAL_SESSION', null)
            expect(useAuthStore.getState().user?.id).toBe('user-1')

            authListener()('SIGNED_OUT', null)
            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null })
        })

        it('ignores a stored value that is not a session', async () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify('not-a-session'))
            const useAuthStore = await loadStore()

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null, loading: true })
        })
    })

    describe('without a cached session', () => {
        it('starts signed out and takes the user from getSession', async () => {
            const useAuthStore = await loadStore()

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null, initialized: false, loading: true })

            const fresh = makeSession('user-2')
            auth.getSession.mockResolvedValue({ data: { session: fresh }, error: null })
            await useAuthStore.getState().initAuth()

            expect(useAuthStore.getState()).toMatchObject({ initialized: true, loading: false })
            expect(useAuthStore.getState().session).toEqual(fresh)
            expect(useAuthStore.getState().user).toEqual(fresh.user)
        })

        it('stays signed out when getSession cannot reach the auth server', async () => {
            const useAuthStore = await loadStore()
            auth.getSession.mockResolvedValue({
                data: { session: null },
                error: new AuthRetryableFetchError('Failed to fetch', 0),
            })

            await useAuthStore.getState().initAuth()
            authListener()('INITIAL_SESSION', null)

            expect(useAuthStore.getState()).toMatchObject({ user: null, session: null, initialized: true })
        })
    })

    it('signOut clears only app-owned keys', async () => {
        storeSession(makeSession('user-1'))
        for (const key of ['teas', 'brews', 'presets', 'journals', 'theme', 'unrelated']) {
            localStorage.setItem(key, '[]')
        }
        const useAuthStore = await loadStore()
        auth.signOut.mockResolvedValue({ error: null })

        await useAuthStore.getState().signOut()

        expect(auth.signOut).toHaveBeenCalledOnce()
        expect(Object.keys(localStorage)).toEqual(['unrelated'])
        expect(useAuthStore.getState()).toMatchObject({ user: null, session: null })
    })
})
