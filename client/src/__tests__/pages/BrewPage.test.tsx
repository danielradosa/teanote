import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import i18n from '@/lang'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'

const toast = vi.hoisted(() => ({ success: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))

const auth = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() }))
// The rows the server holds, and the first-page reads still waiting on it.
const server = vi.hoisted(() => ({ from: vi.fn(), rows: [] as { id: string }[], heldReads: [] as (() => void)[] }))
vi.mock('@/utils/supa', () => ({ default: { auth, from: server.from, channel: vi.fn(), removeChannel: vi.fn() } }))

interface Reply {
    data: unknown
    error: null
}

// One table of the server for the online tests: a read of the first page waits
// until the test lets it through, as on a slow network; writes land at once.
function serverTable() {
    let write = false
    let firstPage = true
    const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        range: (from: number) => {
            firstPage = from === 0
            return query
        },
        upsert: (rows: { id: string }[]) => {
            write = true
            for (const row of rows) server.rows = [...server.rows.filter(r => r.id !== row.id), { ...row }]
            return query
        },
        update: () => {
            write = true
            return query
        },
        then: (onOk: (reply: Reply) => unknown, onError?: (reason: unknown) => unknown) => {
            const reply = (): Reply => ({
                data: write ? null : firstPage ? server.rows.map(r => ({ ...r })) : [],
                error: null,
            })
            const ready = write || !firstPage ? Promise.resolve() : new Promise<void>(resolve => server.heldReads.push(resolve))
            return ready.then(reply).then(onOk, onError)
        },
    }
    return query
}

function goOnline() {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    server.from.mockImplementation(serverTable)
}

// Lets the oldest waiting read through and the sync it belongs to finish.
// `await` asks a query for its result a microtask later, so the reads already
// sent are queued first.
async function releaseRead() {
    await act(async () => {
        for (let i = 0; i < 100; i++) await Promise.resolve()
        const release = server.heldReads.shift()
        if (!release) throw new Error('no read is waiting')
        release()
        for (let i = 0; i < 100; i++) await Promise.resolve()
    })
}

// supabase-js 2.x keeps the session under `sb-<project ref>-auth-token`; the
// auth store reads the signed-in user from it when its module loads.
const AUTH_KEY = 'sb-abcdefghijklmnopqrst-auth-token'
const SESSION_KEY = 'brewSession'
const START = Date.parse('2026-11-14T09:00:00Z')

const tea: Tea = {
    id: 'tea-1',
    name: 'Dan Cong',
    type: 'oolong',
    inventory: '50 g',
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
}

const preset: Preset = {
    id: 'preset-1',
    name: 'Gongfu',
    infusionsAmount: 3,
    infusionTimes: [60, 45, 90],
    updated_at: '2026-11-01T00:00:00Z',
    deleted_at: null,
}

function signInAs(userId: string) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ access_token: `access-${userId}`, user: { id: userId } }))
}

// A fresh copy of the page and its stores, hydrated from localStorage: what a
// full page load gets.
async function loadApp() {
    vi.resetModules()
    const { default: BrewPage } = await import('@/pages/BrewPage')
    const { useBrewsStore } = await import('@/stores/useBrewsStore')
    const { useAuthStore } = await import('@/stores/useAuthStore')
    return { BrewPage, useBrewsStore, useAuthStore }
}

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
    visibility = state
    act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
    })
}

// A locked phone or a hidden tab may run no timers at all: the clock moves on
// and nothing ticks until the page is visible again.
function hiddenFor(ms: number) {
    setVisibility('hidden')
    vi.setSystemTime(Date.now() + ms)
    setVisibility('visible')
}

function tick(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms)
    })
}

function sessionForm() {
    return within(document.querySelector('.new-sesion') as HTMLElement)
}

function startSession(presetId?: string) {
    fireEvent.change(sessionForm().getByLabelText(/Select tea/), { target: { value: tea.id } })
    if (presetId) fireEvent.change(sessionForm().getByLabelText(/Select preset/), { target: { value: presetId } })
    fireEvent.click(screen.getByRole('button', { name: 'start brew' }))
}

function startInfusion() {
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
}

function shownTime() {
    return document.querySelector('.tea-time')?.textContent ?? null
}

beforeAll(async () => {
    if (!i18n.isInitialized) await new Promise<void>(resolve => i18n.on('initialized', () => resolve()))
})

beforeEach(() => {
    localStorage.clear()
    signInAs('user-1')
    localStorage.setItem('teas', JSON.stringify([tea]))
    localStorage.setItem('presets', JSON.stringify([preset]))
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => visibility === 'hidden' })
    // Offline, so no store tries to sync.
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
    toast.success.mockReset()
    server.from.mockReset()
    server.rows = []
    server.heldReads = []
    auth.signOut.mockReset()
    auth.signOut.mockResolvedValue({ error: null })
    vi.useFakeTimers({ now: START, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
})

afterEach(() => {
    cleanup()
    vi.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
    Reflect.deleteProperty(document, 'hidden')
    Reflect.deleteProperty(navigator, 'onLine')
    Reflect.deleteProperty(navigator, 'wakeLock')
})

describe('the brew timer keeps time by the clock', () => {
    it('shows the right remaining time when a countdown becomes visible after N hidden seconds', async () => {
        const { BrewPage } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        expect(shownTime()).toBe('60s')

        tick(5_000)
        expect(shownTime()).toBe('55s')

        hiddenFor(20_000)
        expect(shownTime()).toBe('35s')

        tick(1_000)
        expect(shownTime()).toBe('34s')
    })

    it('completes an infusion whose countdown ends while hidden exactly once', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)

        hiddenFor(120_000)

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
        expect(toast.success).toHaveBeenCalledWith('Infusion finished!')
        expect(shownTime()).toBe('–')
        expect(screen.getByText('Infusion 2 / 3')).toBeInTheDocument()

        tick(70_000)
        hiddenFor(5_000)

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
    })

    it('completes a countdown that ended while the Brews page was closed once, on return', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        view.unmount()

        vi.setSystemTime(Date.now() + 90_000)
        // StrictMode runs every effect twice on mount, as the dev build does.
        render(<StrictMode><BrewPage /></StrictMode>)

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
        expect(shownTime()).toBe('–')
        expect(screen.getByText('Infusion 2 / 3')).toBeInTheDocument()

        tick(10_000)
        expect(useBrewsStore.getState().brews[0].infusions).toHaveLength(1)
    })

    it('records a countdown that ends while the Brews page is closed, at its end', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        // The user goes on to the Dashboard or the Journal.
        view.unmount()

        tick(50_000)

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(JSON.parse(localStorage.getItem('brews')!)[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
        expect(toast.success).toHaveBeenCalledWith('Infusion finished!')
    })

    it('records a countdown that ended while hidden with the Brews page closed, once visible', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        view.unmount()

        hiddenFor(120_000)

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)

        tick(70_000)
        render(<BrewPage />)
        expect(useBrewsStore.getState().brews[0].infusions).toHaveLength(1)
        expect(toast.success).toHaveBeenCalledTimes(1)
        expect(screen.getByText('Infusion 2 / 3')).toBeInTheDocument()
    })

    it('with the Brews page closed, waits for a brew missing from the list and records onto it once back', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        const brews = useBrewsStore.getState().brews
        view.unmount()

        act(() => useBrewsStore.setState({ brews: [] }))
        tick(60_000)
        act(() => useBrewsStore.setState({ brews }))

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
    })

    it('with the Brews page closed, records nothing onto a brew ended elsewhere', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        const brewId = useBrewsStore.getState().brews[0].id
        view.unmount()

        // Another device ends the brew; its row arrives here.
        act(() => useBrewsStore.setState({
            brews: useBrewsStore.getState().brews.map(b => ({ ...b, finishedAt: new Date(START + 5_000) })),
        }))
        tick(60_000)

        expect(useBrewsStore.getState().brews.find(b => b.id === brewId)?.infusions).toEqual([])
        expect(toast.success).not.toHaveBeenCalled()
    })

    it('keeps a count-up correct across a hidden period and records it on finish', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        render(<BrewPage />)
        startSession()
        startInfusion()

        tick(3_000)
        expect(shownTime()).toBe('3s')

        hiddenFor(40_000)
        expect(shownTime()).toBe('43s')

        fireEvent.click(screen.getByRole('button', { name: 'finish infusion' }))

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 43 }])
        expect(shownTime()).toBe('–')
    })
})

describe('the running session survives leaving the page and a reload', () => {
    it('continues the session when the Brews page is unmounted and mounted again', async () => {
        const { BrewPage } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        expect(shownTime()).toBe('50s')
        view.unmount()

        vi.setSystemTime(Date.now() + 15_000)
        render(<BrewPage />)

        expect(shownTime()).toBe('35s')
        expect(screen.getByText('Infusion 1 / 3')).toBeInTheDocument()
        expect(screen.getByText(/Steep 1: 35s/)).toBeInTheDocument()

        tick(35_000)
        expect(shownTime()).toBe('–')
        expect(screen.getByText('Infusion 2 / 3')).toBeInTheDocument()
    })

    it('continues the session after a reload, from what localStorage holds', async () => {
        const first = await loadApp()
        render(<first.BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        const brewId = first.useBrewsStore.getState().brews[0].id
        cleanup()

        vi.setSystemTime(Date.now() + 20_000)
        const second = await loadApp()
        render(<second.BrewPage />)

        expect(shownTime()).toBe('30s')
        expect(screen.getByText(/Preset: Gongfu/)).toBeInTheDocument()

        tick(30_000)
        const brew = second.useBrewsStore.getState().brews.find(b => b.id === brewId)
        expect(brew?.infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)

        // The next infusion still follows the preset: 45 s.
        startInfusion()
        expect(shownTime()).toBe('45s')
    })

    it('clears the session on sign-out', async () => {
        const { BrewPage, useBrewsStore, useAuthStore } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        const brewId = useBrewsStore.getState().brews[0].id
        expect(localStorage.getItem(SESSION_KEY)).toContain(brewId)
        const user = useAuthStore.getState().user
        view.unmount()

        await act(() => useAuthStore.getState().signOut())
        expect(localStorage.getItem(SESSION_KEY)).toBeNull()

        // The same account signs in again without a reload: nothing resumes.
        act(() => useAuthStore.setState({ user }))
        render(<BrewPage />)
        expect(shownTime()).toBeNull()
    })

    it('signOut removes the stored session even when the Brews page never loaded', async () => {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: 'user-1', brewId: 'brew-1', presetId: null, run: null }))
        vi.resetModules()
        const { useAuthStore } = await import('@/stores/useAuthStore')

        await useAuthStore.getState().signOut()

        expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    })

    it('discards a session that belongs to another account', async () => {
        const first = await loadApp()
        render(<first.BrewPage />)
        startSession(preset.id)
        startInfusion()
        cleanup()

        // Same account after a reload: the session resumes.
        const second = await loadApp()
        render(<second.BrewPage />)
        expect(shownTime()).toBe('60s')
        cleanup()

        // Another account on this device: it is dropped, not resumed.
        signInAs('user-2')
        const third = await loadApp()
        render(<third.BrewPage />)
        expect(shownTime()).toBeNull()
        expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    })

    it('discards a session whose brew was deleted', async () => {
        const first = await loadApp()
        render(<first.BrewPage />)
        startSession(preset.id)
        startInfusion()
        cleanup()

        const second = await loadApp()
        render(<second.BrewPage />)
        expect(shownTime()).toBe('60s')

        act(() => second.useBrewsStore.getState().deleteBrew(second.useBrewsStore.getState().brews[0].id))

        expect(shownTime()).toBeNull()
        expect(localStorage.getItem(SESSION_KEY)).toBeNull()
        tick(120_000)
        expect(second.useBrewsStore.getState().brews[0].infusions).toEqual([])
    })

    it('keeps the session while an older sync briefly drops its brew, and records the infusion', async () => {
        goOnline()
        const { BrewPage, useBrewsStore } = await loadApp()
        render(<BrewPage />)
        // A sync from before the brew existed (start-up, periodic, reconnect or
        // the previous session's end) is still waiting on the server.
        act(() => {
            void useBrewsStore.getState().syncBrews()
        })
        startSession(preset.id)
        startInfusion()
        tick(10_000)

        // It lands first, with the copy of the brews it took before the brew existed.
        await releaseRead()
        expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()

        // The brew's own sync lands: the timer is back where the clock says.
        await releaseRead()
        expect(shownTime()).toBe('50s')

        tick(50_000)
        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
    })

    it('keeps the session while its brew is missing from the list, and records onto it once it is back', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(10_000)
        const brews = useBrewsStore.getState().brews

        // A sync lands with a copy of the list from before the brew existed.
        act(() => useBrewsStore.setState({ brews: [] }))
        expect(shownTime()).toBeNull()
        expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()

        // The countdown ends while the brew is missing, then the brew is back.
        tick(60_000)
        act(() => useBrewsStore.setState({ brews }))

        expect(useBrewsStore.getState().brews[0].infusions).toEqual([{ number: 1, actualTime: 60 }])
        expect(toast.success).toHaveBeenCalledTimes(1)
        expect(shownTime()).toBe('–')
        expect(screen.getByText('Infusion 2 / 3')).toBeInTheDocument()
    })

    it('records the running infusion on its own brew when another brew is started', async () => {
        const { BrewPage, useBrewsStore } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        tick(30_000)
        const firstId = useBrewsStore.getState().brews[0].id
        const brew = (id: string) => useBrewsStore.getState().brews.find(b => b.id === id)

        startSession(preset.id)

        const secondId = useBrewsStore.getState().brews.find(b => b.id !== firstId)!.id
        expect(brew(firstId)?.infusions).toEqual([{ number: 1, actualTime: 30 }])
        expect(brew(secondId)?.infusions).toEqual([])
        expect(shownTime()).toBe('–')
        expect(screen.getByText('Infusion 1 / 3')).toBeInTheDocument()

        tick(60_000)
        expect(brew(firstId)?.infusions).toHaveLength(1)
        expect(brew(secondId)?.infusions).toEqual([])
    })
})

class FakeWakeLock {
    released = false
    readonly type = 'screen'
    release = vi.fn(async () => {
        this.released = true
    })
}

function installWakeLock(request: () => Promise<FakeWakeLock>) {
    const wakeLock = { request: vi.fn(request) }
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: wakeLock })
    return wakeLock
}

// Lets the request promises settle.
async function flush() {
    await act(async () => {})
}

describe('the screen wake lock during a countdown', () => {
    it('holds a lock while a countdown runs and releases it when the countdown ends', async () => {
        const locks: FakeWakeLock[] = []
        const wakeLock = installWakeLock(async () => {
            const lock = new FakeWakeLock()
            locks.push(lock)
            return lock
        })
        const { BrewPage } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        await flush()
        expect(wakeLock.request).not.toHaveBeenCalled()

        startInfusion()
        await flush()
        expect(wakeLock.request).toHaveBeenCalledTimes(1)
        expect(wakeLock.request).toHaveBeenCalledWith('screen')
        expect(locks[0].release).not.toHaveBeenCalled()

        tick(60_000)
        await flush()
        expect(locks[0].release).toHaveBeenCalledTimes(1)
        expect(wakeLock.request).toHaveBeenCalledTimes(1)
    })

    it('asks for the lock again when the page becomes visible again', async () => {
        const locks: FakeWakeLock[] = []
        const wakeLock = installWakeLock(async () => {
            const lock = new FakeWakeLock()
            locks.push(lock)
            return lock
        })
        const { BrewPage } = await loadApp()
        render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        await flush()
        expect(wakeLock.request).toHaveBeenCalledTimes(1)

        // The browser drops a screen wake lock when the page is hidden.
        locks[0].released = true
        setVisibility('hidden')
        await flush()
        expect(wakeLock.request).toHaveBeenCalledTimes(1)

        setVisibility('visible')
        await flush()
        expect(wakeLock.request).toHaveBeenCalledTimes(2)
    })

    it('releases the lock when the infusion is finished early and when the page unmounts', async () => {
        const locks: FakeWakeLock[] = []
        installWakeLock(async () => {
            const lock = new FakeWakeLock()
            locks.push(lock)
            return lock
        })
        const { BrewPage } = await loadApp()
        const view = render(<BrewPage />)
        startSession(preset.id)
        startInfusion()
        await flush()
        tick(5_000)

        fireEvent.click(screen.getByRole('button', { name: 'finish infusion' }))
        await flush()
        expect(locks[0].release).toHaveBeenCalledTimes(1)

        startInfusion()
        await flush()
        expect(locks).toHaveLength(2)

        view.unmount()
        await flush()
        expect(locks[1].release).toHaveBeenCalledTimes(1)
    })

    it('takes no lock for a count-up, and a refused request leaves the countdown running', async () => {
        const wakeLock = installWakeLock(() => Promise.reject(new DOMException('denied', 'NotAllowedError')))
        const { BrewPage } = await loadApp()
        render(<BrewPage />)
        startSession()
        startInfusion()
        await flush()
        expect(wakeLock.request).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'end brew session' }))

        startSession(preset.id)
        startInfusion()
        await flush()
        expect(wakeLock.request).toHaveBeenCalledTimes(1)

        tick(5_000)
        expect(shownTime()).toBe('55s')
    })
})
