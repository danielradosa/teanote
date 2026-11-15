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
const DAY1 = '2026-11-10T09:30:00.000Z'
const DAY3 = '2026-11-12T18:00:00.000Z'

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
    vi.useRealTimers()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'onLine')
})

function online(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

describe('useJournalsStore: records the journals table accepts', () => {
    it("a stored journal with brew_preset_id '' is sent once, with no brew (null), every other field and its updated_at kept", async () => {
        const stuck = journal('j-stuck', { brew_preset_id: '', title: 'Written before the fix', rating: 5 })
        stored([stuck])

        const first = await useJournalsStore.getState().syncJournals()
        const second = await useJournalsStore.getState().syncJournals()

        expect([first, second]).toEqual([true, true])
        expect(journalWrites().map(w => w.op)).toEqual(['upsert'])
        // Stored without dateAdded (addJournal never set it), so the repair also dates it by its own updated_at.
        const repaired = { ...stuck, brew_preset_id: null, dateAdded: T0 }
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
        expect(server.row('journals', stuck.id)).toEqual({ ...stuck, rating: 4, dateAdded: T0 })
        expect(storedJournals()).toEqual([{ ...stuck, rating: 4, dateAdded: T0 }])
    })

    it('a rating outside the integer range is kept and sent as typed, so the server refuses it as before', async () => {
        // What such a rating should become is the owner's call. The journal form
        // brings a typed rating into 1 to 5; a direct addJournal still sends it.
        useJournalsStore.getState().addJournal({ teaId: 'tea-1', brew_preset_id: 'brew-1', title: 'Typed by hand', rating: 99999999999, content: 'notes', images: [] })
        await vi.waitFor(() => expect(useSyncStore.getState().activeSyncs).toBe(0))

        expect(useJournalsStore.getState().journals[0].rating).toBe(99999999999)
        expect(storedJournals()[0].rating).toBe(99999999999)
        expect(journalWrites().map(w => (w.payload as Row[])[0].rating)).toEqual([99999999999])
        expect(server.rows('journals')).toEqual([])
        expect(useSyncStore.getState().justSynced).toBe(false)
    })
})

describe('useJournalsStore: a journal added offline', () => {
    it('is kept with no brew (null) and a whole-number rating, in state and in localStorage', () => {
        online(false)

        // What the journal form passes for "no brew" and a rating typed as 3.5.
        useJournalsStore.getState().addJournal({ teaId: 'tea-1', brew_preset_id: '', title: 'Offline', rating: 3.5, content: 'notes', images: [] })

        expect(useJournalsStore.getState().journals[0]).toMatchObject({ brew_preset_id: null, rating: 4 })
        expect(storedJournals()[0]).toMatchObject({ brew_preset_id: null, rating: 4 })
        expect(journalWrites()).toEqual([])
    })
})

describe('useJournalsStore: the date a journal was written (dateAdded)', () => {
    it('a journal added offline carries the moment it was written, and is sent with it when it syncs days later', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(DAY1))
        online(false)

        useJournalsStore.getState().addJournal({ teaId: 'tea-1', brew_preset_id: null, title: 'Written offline', rating: 4, content: 'notes', images: [] })
        const [added] = useJournalsStore.getState().journals
        expect(added).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })
        expect(storedJournals()[0]).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })

        // Without a dateAdded in the upsert, the column's default (now()) would date it DAY3.
        vi.setSystemTime(new Date(DAY3))
        online(true)
        expect(await useJournalsStore.getState().syncJournals()).toBe(true)

        expect(journalWrites().map(w => (w.payload as Row[])[0])).toEqual([expect.objectContaining({ dateAdded: DAY1, updated_at: DAY1 })])
        expect(server.row('journals', added.id)).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })
    })

    it('a stored journal without dateAdded is dated by its own updated_at when it syncs, updated_at untouched; one with a dateAdded keeps it', async () => {
        const undated = journal('j-undated', { updated_at: T0 })
        const dated = journal('j-dated', { dateAdded: '2026-08-15T10:00:00.000Z', updated_at: T1 })
        // On the server with its date; this device's copy has not been pulled since it was first sent.
        const onServer = { ...journal('j-on-server'), dateAdded: '2026-07-01T07:00:00.000Z' }
        server.seed('journals', [onServer] as unknown as Row[])
        stored([undated, dated, journal('j-on-server')])

        const first = await useJournalsStore.getState().syncJournals()
        const second = await useJournalsStore.getState().syncJournals()

        expect([first, second]).toEqual([true, true])
        expect(journalWrites().map(w => (w.payload as Row[])[0])).toEqual([
            expect.objectContaining({ id: 'j-undated', dateAdded: T0, updated_at: T0 }),
            expect.objectContaining({ id: 'j-dated', dateAdded: '2026-08-15T10:00:00.000Z', updated_at: T1 }),
        ])
        expect(server.row('journals', 'j-on-server')).toEqual(onServer)
        expect(storedJournals().sort((a, b) => a.id.localeCompare(b.id))).toEqual([
            dated,
            onServer,
            { ...undated, dateAdded: T0 },
        ])
    })

    it('an edit to a journal stored without dateAdded dates it by its last write before the edit, not by the edit', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(DAY3))
        online(false)
        stored([journal('j-undated', { updated_at: T0 })])

        useJournalsStore.getState().updateJournal('j-undated', { title: 'Renamed' })

        expect(useJournalsStore.getState().journals[0]).toMatchObject({ title: 'Renamed', dateAdded: T0, updated_at: DAY3 })
        expect(storedJournals()[0]).toMatchObject({ title: 'Renamed', dateAdded: T0, updated_at: DAY3 })
        online(true)
        expect(await useJournalsStore.getState().syncJournals()).toBe(true)
        expect(server.row('journals', 'j-undated')).toMatchObject({ title: 'Renamed', dateAdded: T0, updated_at: DAY3 })
    })
})
