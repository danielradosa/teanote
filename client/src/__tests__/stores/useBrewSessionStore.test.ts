vi.mock('@/utils/supa', () => ({
    default: {
        auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
        from: vi.fn(),
        channel: vi.fn(),
        removeChannel: vi.fn(),
    },
}))

const AUTH_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const SESSION_KEY = 'brewSession'
const START = Date.parse('2026-11-14T09:00:00Z')

// The store reads localStorage when its module loads, so each test imports a
// fresh copy after preparing it: what a page reload does.
async function loadStores() {
    vi.resetModules()
    const { useBrewSessionStore, runSecs } = await import('@/stores/useBrewSessionStore')
    const { useBrewsStore } = await import('@/stores/useBrewsStore')
    return { useBrewSessionStore, runSecs, useBrewsStore }
}

describe('useBrewSessionStore', () => {
    beforeEach(() => {
        localStorage.clear()
        localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: 'access-user-1', user: { id: 'user-1' } }))
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
        vi.useFakeTimers({ now: START, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    })

    afterEach(() => {
        vi.useRealTimers()
        Reflect.deleteProperty(navigator, 'onLine')
    })

    it('a fresh store hydrated from localStorage continues the session', async () => {
        const first = await loadStores()
        const brewId = first.useBrewsStore.getState().addBrew({ teaId: 'tea-1' }) as string
        first.useBrewSessionStore.getState().startSession(brewId, null)
        first.useBrewSessionStore.getState().startRun(60)

        vi.setSystemTime(START + 25_000)
        const second = await loadStores()
        const session = second.useBrewSessionStore.getState().session

        expect(session).toEqual({
            userId: 'user-1',
            brewId,
            presetId: null,
            run: { startedAt: START, endsAt: START + 60_000 },
        })
        expect(second.runSecs(session!.run!, Date.now())).toBe(35)
    })

    it('records a finished infusion once, however often it is finished', async () => {
        const { useBrewSessionStore, useBrewsStore } = await loadStores()
        const brewId = useBrewsStore.getState().addBrew({ teaId: 'tea-1' }) as string
        useBrewSessionStore.getState().startSession(brewId, null)
        useBrewSessionStore.getState().startRun(60)

        const at = START + 61_000
        expect(useBrewSessionStore.getState().finishRun(at)).toEqual({ actualTime: 60, completed: true })
        expect(useBrewSessionStore.getState().finishRun(at)).toBeNull()

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).run).toBeNull()
    })

    it('waits out a countdown longer than a browser timeout can hold without firing early', async () => {
        const { useBrewSessionStore, useBrewsStore } = await loadStores()
        const brewId = useBrewsStore.getState().addBrew({ teaId: 'tea-1' }) as string
        useBrewSessionStore.getState().startSession(brewId, null)
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

        // 30 days, typed into a preset by mistake.
        useBrewSessionStore.getState().startRun(30 * 24 * 3600)
        vi.advanceTimersByTime(5_000)

        expect(setTimeoutSpy.mock.calls.length).toBeLessThan(5)
        expect(useBrewSessionStore.getState().session?.run).not.toBeNull()
        setTimeoutSpy.mockRestore()
    })

    it('ignores a stored value that is not a session', async () => {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ brewId: 'brew-1', run: { startedAt: 'yesterday' } }))

        const { useBrewSessionStore } = await loadStores()

        expect(useBrewSessionStore.getState().session).toBeNull()
    })

    // Two tabs share localStorage but each holds its own copy of the stores;
    // a fresh import after the first plays the second tab.
    describe('with the app open in two tabs', () => {
        async function startCountdownThenOpenSecondTab() {
            const a = await loadStores()
            const brewId = a.useBrewsStore.getState().addBrew({ teaId: 'tea-1' }) as string
            a.useBrewSessionStore.getState().startSession(brewId, null)
            a.useBrewSessionStore.getState().startRun(60)
            const b = await loadStores()
            return { a, b, brewId }
        }

        const storedBrew = () => JSON.parse(localStorage.getItem('brews')!)[0]

        it('does not record again a run the other tab has finished', async () => {
            const { a, b } = await startCountdownThenOpenSecondTab()

            expect(a.useBrewSessionStore.getState().finishRun(START + 61_000)).toEqual({ actualTime: 60, completed: true })
            // Tab B receives tab A's row (realtime or a sync).
            b.useBrewsStore.setState({ brews: [storedBrew()] })

            expect(b.useBrewSessionStore.getState().finishRun(START + 61_000)).toBeNull()
            expect(b.useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
            expect(storedBrew().infusions).toEqual([{ number: 1, actualTime: 60 }])
            expect(b.useBrewSessionStore.getState().session?.run).toBeNull()
        })

        it('does not reopen a brew the other tab has ended', async () => {
            const { a, b, brewId } = await startCountdownThenOpenSecondTab()

            // Tab A ends the session 10 s in, as "end brew session" does.
            a.useBrewSessionStore.getState().finishRun(START + 10_000)
            a.useBrewsStore.getState().updateBrew(brewId, { finishedAt: new Date(START + 10_000) })
            a.useBrewSessionStore.getState().clearSession()

            // Tab B, still holding the run, reaches the countdown's end.
            expect(b.useBrewSessionStore.getState().finishRun(START + 61_000)).toBeNull()
            expect(storedBrew().finishedAt).toBeTruthy()
            expect(storedBrew().infusions).toEqual([{ number: 1, actualTime: 10 }])
            expect(localStorage.getItem(SESSION_KEY)).toBeNull()
            expect(b.useBrewSessionStore.getState().session).toBeNull()
        })

        it('follows the session the other tab starts and ends', async () => {
            const b = await loadStores()
            const a = await loadStores()
            const brewId = a.useBrewsStore.getState().addBrew({ teaId: 'tea-1' }) as string
            a.useBrewSessionStore.getState().startSession(brewId, null)
            a.useBrewSessionStore.getState().startRun(60)
            // The browser tells every other tab of the change.
            window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: localStorage.getItem(SESSION_KEY) }))

            expect(b.useBrewSessionStore.getState().session).toEqual(a.useBrewSessionStore.getState().session)

            a.useBrewSessionStore.getState().clearSession()
            window.dispatchEvent(new StorageEvent('storage', { key: SESSION_KEY, newValue: null }))

            expect(b.useBrewSessionStore.getState().session).toBeNull()
        })
    })
})
