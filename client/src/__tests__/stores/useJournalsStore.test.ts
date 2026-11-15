import type { User } from '@supabase/supabase-js'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import type { Journal } from '@/types/Journal'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const T0 = '2026-09-01T08:00:00.000Z'
const T1 = '2026-10-01T08:00:00.000Z'

function journal(id: string, overrides: Partial<Journal> = {}): Journal {
    return {
        id,
        user_id: USER,
        teaId: 'tea-1',
        brew_preset_id: 'brew-1',
        title: `Entry ${id}`,
        rating: 4,
        content: 'notes',
        images: [],
        updated_at: T0,
        deleted_at: null,
        ...overrides,
    }
}

/** What this device has in localStorage, as a page load hydrates it. */
function stored(journals: Journal[]) {
    localStorage.setItem('journals', JSON.stringify(journals))
    useJournalsStore.setState({ journals })
}

function storedJournals(): Journal[] {
    return JSON.parse(localStorage.getItem('journals') ?? '[]')
}

function journalWrites() {
    return server.writes.filter(w => w.table === 'journals')
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    useAuthStore.setState({ user: { id: USER } as User })
    useSyncStore.setState(useSyncStore.getInitialState())
    useJournalsStore.setState({ journals: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'onLine')
})

describe('useJournalsStore: records the journals table accepts', () => {
    it("a stored journal with brew_preset_id '' is sent once, with no brew (null), every other field and its updated_at kept", async () => {
        const stuck = journal('j-stuck', { brew_preset_id: '', title: 'Written before the fix', rating: 5 })
        stored([stuck])

        const first = await useJournalsStore.getState().syncJournals()
        const second = await useJournalsStore.getState().syncJournals()

        expect([first, second]).toEqual([true, true])
        expect(journalWrites().map(w => w.op)).toEqual(['upsert'])
        const repaired = { ...stuck, brew_preset_id: null }
        expect(server.row('journals', stuck.id)).toEqual(repaired)
        expect(storedJournals()).toEqual([repaired])
        expect(useJournalsStore.getState().journals).toEqual([repaired])
    })

    it('leaves alone a journal that links a brew, and does not let a stale local copy overwrite the server', async () => {
        const linked = journal('j-linked')
        // Edited to "no brew" here at T0, but the server holds a newer edit (T1) from another device.
        const stale = journal('j-stale', { brew_preset_id: '', updated_at: T0 })
        const newerOnServer = journal('j-stale', { brew_preset_id: 'brew-2', title: 'Edited elsewhere', updated_at: T1 })
        server.seed('journals', [linked, newerOnServer] as unknown as Row[])
        stored([linked, stale])

        const synced = await useJournalsStore.getState().syncJournals()

        expect(synced).toBe(true)
        expect(journalWrites()).toEqual([])
        expect(server.rows('journals')).toEqual([linked, newerOnServer])
        expect(storedJournals().sort((a, b) => a.id.localeCompare(b.id))).toEqual([linked, newerOnServer])
    })

    it("an edit that unlinks the brew (the form's empty choice) is stored and sent as null", async () => {
        const linked = journal('j-1')
        server.seed('journals', [linked] as unknown as Row[])
        stored([linked])

        useJournalsStore.getState().updateJournal(linked.id, { ...linked, brew_preset_id: '' })
        expect(useJournalsStore.getState().journals[0].brew_preset_id).toBeNull()
        expect(storedJournals()[0].brew_preset_id).toBeNull()

        await vi.waitFor(() => expect(useSyncStore.getState().activeSyncs).toBe(0))
        expect(journalWrites().map(w => w.op)).toEqual(['upsert'])
        expect(server.row('journals', linked.id)).toMatchObject({ brew_preset_id: null, title: linked.title })
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it('a stored journal with a fractional rating is sent once, rated with the nearest whole number', async () => {
        const stuck = journal('j-half', { rating: 3.5 })
        stored([stuck])

        const first = await useJournalsStore.getState().syncJournals()
        const second = await useJournalsStore.getState().syncJournals()

        expect([first, second]).toEqual([true, true])
        expect(journalWrites()).toHaveLength(1)
        expect(server.row('journals', stuck.id)).toEqual({ ...stuck, rating: 4 })
        expect(storedJournals()).toEqual([{ ...stuck, rating: 4 }])
    })

    it('a rating outside the integer range is kept and sent as typed, so the server refuses it as before', async () => {
        // What such a rating should become is the owner's call. Kept within the
        // integer range instead, it was stored and synced, and the journal list
        // cannot draw it ('⭐'.repeat throws) on any device of the account.
        useJournalsStore.getState().addJournal({ teaId: 'tea-1', brew_preset_id: 'brew-1', title: 'Typed by hand', rating: 99999999999, content: 'notes', images: [] })
        await vi.waitFor(() => expect(useSyncStore.getState().activeSyncs).toBe(0))

        expect(useJournalsStore.getState().journals[0].rating).toBe(99999999999)
        expect(storedJournals()[0].rating).toBe(99999999999)
        expect(journalWrites().map(w => (w.payload as Row[])[0].rating)).toEqual([99999999999])
        expect(server.rows('journals')).toEqual([])
        expect(useSyncStore.getState().justSynced).toBe(false)
    })
})
