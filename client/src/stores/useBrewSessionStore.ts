import { create } from 'zustand'
import toast from 'react-hot-toast'
import { t } from 'i18next'
import { storage } from '@/helpers/storage'
import { useAuthStore } from '@/stores/useAuthStore'
import { useBrewsStore } from '@/stores/useBrewsStore'

// The brew session being timed, mirrored to localStorage like the other stores
// so it survives leaving the Brews page and a reload. An infusion is kept as
// instants, never as a tick count: its time always comes from the clock.
export const BREW_SESSION_KEY = 'brewSession'

export interface BrewRun {
    startedAt: number
    // When a countdown ends; null when counting up.
    endsAt: number | null
}

export interface BrewSession {
    userId: string
    brewId: string
    presetId: string | null
    // The infusion being steeped; null between infusions.
    run: BrewRun | null
}

export interface FinishedRun {
    actualTime: number
    // A countdown that reached its end.
    completed: boolean
}

interface BrewSessionState {
    session: BrewSession | null
    startSession: (brewId: string, presetId: string | null) => void
    startRun: (plannedSecs: number | null) => void
    finishRun: (at: number) => FinishedRun | null
    clearSession: () => void
}

export function runPlannedSecs(run: BrewRun): number | null {
    return run.endsAt === null ? null : (run.endsAt - run.startedAt) / 1000
}

function runElapsedSecs(run: BrewRun, at: number): number {
    return Math.max(0, Math.floor((at - run.startedAt) / 1000))
}

// What the timer shows at `at`: seconds left for a countdown, seconds so far
// when counting up.
export function runSecs(run: BrewRun, at: number): number {
    const planned = runPlannedSecs(run)
    const elapsed = runElapsedSecs(run, at)
    return planned === null ? elapsed : Math.max(0, planned - elapsed)
}

function isBrewSession(value: unknown): value is BrewSession {
    if (typeof value !== 'object' || value === null) return false
    const s = value as Record<string, unknown>
    if (typeof s.userId !== 'string' || typeof s.brewId !== 'string') return false
    if (s.presetId !== null && typeof s.presetId !== 'string') return false
    if (s.run === null) return true
    if (typeof s.run !== 'object') return false
    const run = s.run as Record<string, unknown>
    return typeof run.startedAt === 'number' && (run.endsAt === null || typeof run.endsAt === 'number')
}

function readSession(): BrewSession | null {
    const stored = storage.get<unknown>(BREW_SESSION_KEY, null)
    return isBrewSession(stored) ? stored : null
}

export const useBrewSessionStore = create<BrewSessionState>((set, get) => {
    const save = (session: BrewSession) => {
        storage.set(BREW_SESSION_KEY, session)
        set({ session })
    }

    return {
        session: readSession(),

        startSession: (brewId, presetId) => {
            const { user } = useAuthStore.getState()
            if (!user) return
            save({ userId: user.id, brewId, presetId, run: null })
        },

        startRun: (plannedSecs) => {
            const session = get().session
            if (!session || session.run) return
            const startedAt = Date.now()
            save({ ...session, run: { startedAt, endsAt: plannedSecs ? startedAt + plannedSecs * 1000 : null } })
        },

        // Ends the running infusion and records it, once: the run is cleared
        // before anything is recorded, so a second call finds nothing. A
        // countdown whose end has passed records its planned time, as a normal
        // completion does; otherwise the whole seconds elapsed are recorded.
        finishRun: (at) => {
            const session = get().session
            const run = session?.run
            if (!session || !run) return null
            // Another tab may have finished or replaced this run already. The
            // stored session decides: a run it no longer holds is not recorded
            // again, and this tab takes the stored session instead.
            const stored = readSession()
            if (stored?.brewId !== session.brewId || stored.run?.startedAt !== run.startedAt) {
                set({ session: stored })
                return null
            }
            save({ ...session, run: null })

            const planned = runPlannedSecs(run)
            const completed = planned !== null && run.endsAt !== null && at >= run.endsAt
            const actualTime = completed ? planned : runElapsedSecs(run, at)
            if (actualTime > 0) useBrewsStore.getState().addInfusion(session.brewId, { actualTime })
            return { actualTime, completed }
        },

        clearSession: () => {
            storage.remove(BREW_SESSION_KEY)
            set({ session: null })
        },
    }
})

// A session belongs to the account that started it: signing out, or another
// account signing in, discards it.
useAuthStore.subscribe(({ user }) => {
    const { session, clearSession } = useBrewSessionStore.getState()
    if (session && session.userId !== user?.id) clearSession()
})

// Another tab's change to the session reaches this one.
window.addEventListener('storage', (event) => {
    if (event.key === BREW_SESSION_KEY || event.key === null) useBrewSessionStore.setState({ session: readSession() })
})

// A countdown is completed when its end passes, whether or not the timer is on
// screen: on time while the page runs timers, otherwise as soon as it is
// visible again. While its brew is missing from the list (an older sync
// landing) it waits, and is recorded onto the brew once it is back; nothing is
// recorded onto a brew that is deleted or ended.
let endTimer: ReturnType<typeof setTimeout> | undefined
// Browsers fire a longer timeout at once.
const MAX_TIMEOUT_MS = 2_147_483_647

function completeEndedRun() {
    clearTimeout(endTimer)
    endTimer = undefined
    const { session, finishRun } = useBrewSessionStore.getState()
    const run = session?.run
    if (!session || !run || run.endsAt === null) return
    const left = run.endsAt - Date.now()
    if (left > 0) {
        endTimer = setTimeout(completeEndedRun, Math.min(left, MAX_TIMEOUT_MS))
        return
    }
    const brew = useBrewsStore.getState().brews.find(b => b.id === session.brewId)
    if (!brew || brew.deleted_at || brew.finishedAt) return
    if (finishRun(Date.now())?.completed) toast.success(`${t('toast_infusion_finished')}`)
}

useBrewSessionStore.subscribe(completeEndedRun)
useBrewsStore.subscribe(completeEndedRun)
document.addEventListener('visibilitychange', completeEndedRun)
completeEndedRun()
