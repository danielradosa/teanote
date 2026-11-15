import type { User } from '@supabase/supabase-js'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTeasStore } from '@/stores/useTeasStore'
import type { Tea } from '@/types/Tea'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const OLD = `${USER}/old.jpg`
const NEW = `${USER}/new.jpg`
const T0 = '2026-11-01T00:00:00.000Z'
const DAY1 = '2026-11-10T09:30:00.000Z'
const DAY3 = '2026-11-12T18:00:00.000Z'

function tea(overrides: Partial<Tea> = {}): Tea {
    return {
        id: 'tea-1',
        user_id: USER,
        name: 'Sencha',
        type: 'green',
        inventory: '',
        image: '',
        image_path: OLD,
        updated_at: T0,
        deleted_at: null,
        ...overrides,
    }
}

/** The same teas on this device and on the server, with their photos in storage. */
function given(teas: Tea[]) {
    localStorage.setItem('teas', JSON.stringify(teas))
    useTeasStore.setState({ teas })
    server.seed('teas', teas as unknown as Row[])
    for (const t of teas) if (t.image_path) server.bucket('teas').add(t.image_path)
}

/** Lets every pending sync and storage call settle. */
async function settle() {
    for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    useAuthStore.setState({ user: { id: USER } as User })
    useTeasStore.setState({ teas: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

function storedTeas(): Tea[] {
    return JSON.parse(localStorage.getItem('teas') ?? '[]')
}

function teaWrites() {
    return server.writes.filter(w => w.table === 'teas')
}

describe('useTeasStore.updateTea and the tea photo file', () => {
    it('deletes the replaced photo, only once the server copy of the tea points at the new one', async () => {
        given([tea()])
        server.bucket('teas').add(NEW)
        let serverPathAtRemoval: unknown = 'not removed'
        let localPathAtRemoval: unknown = 'not removed'
        server.onRemove = () => {
            serverPathAtRemoval = server.row('teas', 'tea-1')?.image_path
            localPathAtRemoval = useTeasStore.getState().teas.find(t => t.id === 'tea-1')?.image_path
        }

        useTeasStore.getState().updateTea('tea-1', { image_path: NEW })
        await settle()

        expect(server.removeCalls).toEqual([{ bucket: 'teas', paths: [OLD] }])
        expect(serverPathAtRemoval).toBe(NEW)
        expect(localPathAtRemoval).toBe(NEW)
        expect([...server.bucket('teas')]).toEqual([NEW])
    })

    it('deletes a removed photo once the server copy of the tea no longer has one', async () => {
        given([tea()])
        let serverPathAtRemoval: unknown = 'not removed'
        server.onRemove = () => { serverPathAtRemoval = server.row('teas', 'tea-1')?.image_path }

        useTeasStore.getState().updateTea('tea-1', { image: '', image_path: null })
        await settle()

        expect(server.removeCalls).toEqual([{ bucket: 'teas', paths: [OLD] }])
        expect(serverPathAtRemoval).toBeNull()
    })

    it('keeps the old photo when the sync that carries the change fails', async () => {
        given([tea()])
        server.failRead = () => ({ message: 'network down' })

        useTeasStore.getState().updateTea('tea-1', { image_path: NEW })
        await settle()

        expect(server.removeCalls).toEqual([])
    })

    it('keeps the old photo when the change is made offline', async () => {
        given([tea()])
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

        useTeasStore.getState().updateTea('tea-1', { image_path: NEW })
        await settle()

        expect(server.removeCalls).toEqual([])
    })

    it('never deletes a photo that a record still references', async () => {
        // Another device changed the tea later and still uses the old photo: its copy wins the merge.
        given([tea()])
        server.seed('teas', [{ ...tea(), name: 'Sencha (renamed elsewhere)', updated_at: '2999-01-01T00:00:00.000Z' }] as unknown as Row[])

        useTeasStore.getState().updateTea('tea-1', { image_path: NEW })
        await settle()

        expect(useTeasStore.getState().teas.find(t => t.id === 'tea-1')?.image_path).toBe(OLD)
        expect(server.removeCalls).toEqual([])
    })

    describe('for an edit that started before a sync brought in another photo', () => {
        // The edit form opened with OLD; a sync then brought in OTHER, uploaded on another device.
        const OTHER = `${USER}/other.jpg`

        beforeEach(() => {
            given([tea({ image_path: OTHER, updated_at: '2026-11-02T00:00:00.000Z' })])
            server.bucket('teas').add(OLD)
        })

        it('deletes no photo when the edit kept the one it started from', async () => {
            useTeasStore.getState().updateTea('tea-1', { ...tea(), notes: 'Grassy' }, OLD)
            await settle()

            expect(server.removeCalls).toEqual([])
        })

        it('deletes only the photo the edit started from when it replaces it', async () => {
            useTeasStore.getState().updateTea('tea-1', { ...tea(), image_path: NEW }, OLD)
            await settle()

            expect(server.removeCalls).toEqual([{ bucket: 'teas', paths: [OLD] }])
            expect(server.bucket('teas').has(OTHER)).toBe(true)
        })
    })

    it('deletes nothing when the photo did not change', async () => {
        given([tea()])

        useTeasStore.getState().updateTea('tea-1', { name: 'Gyokuro' })
        await settle()

        expect(server.removeCalls).toEqual([])
    })
})

describe('useTeasStore: the date a tea was added (dateAdded)', () => {
    it('a tea added offline carries the moment it was added, and is sent with it when it syncs days later', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(DAY1))
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

        useTeasStore.getState().addTea({ name: 'Gyokuro', type: 'green', inventory: '' })
        const [added] = useTeasStore.getState().teas
        expect(added).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })
        expect(storedTeas()[0]).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })

        // Without a dateAdded in the upsert, the column's default (now()) would date it DAY3.
        vi.setSystemTime(new Date(DAY3))
        onLine.mockReturnValue(true)
        expect(await useTeasStore.getState().syncTeas()).toBe(true)

        expect(teaWrites().map(w => (w.payload as Row[])[0])).toEqual([expect.objectContaining({ dateAdded: DAY1, updated_at: DAY1 })])
        expect(server.row('teas', added.id)).toMatchObject({ dateAdded: DAY1, updated_at: DAY1 })
    })

    it('a stored tea without dateAdded is dated by its own updated_at when it syncs, updated_at untouched; one with a dateAdded keeps it', async () => {
        const undated = tea({ id: 'tea-undated', image_path: null, updated_at: T0 })
        const dated = tea({ id: 'tea-dated', image_path: null, dateAdded: '2026-08-15T10:00:00.000Z', updated_at: '2026-11-02T00:00:00.000Z' })
        // On the server with its date; this device's copy has not been pulled since it was first sent.
        const onServer = tea({ id: 'tea-on-server', image_path: null, dateAdded: '2026-07-01T07:00:00.000Z' })
        server.seed('teas', [onServer] as unknown as Row[])
        const local = [undated, dated, tea({ id: 'tea-on-server', image_path: null })]
        localStorage.setItem('teas', JSON.stringify(local))
        useTeasStore.setState({ teas: local })

        const first = await useTeasStore.getState().syncTeas()
        const second = await useTeasStore.getState().syncTeas()

        expect([first, second]).toEqual([true, true])
        expect(teaWrites().map(w => (w.payload as Row[])[0])).toEqual([
            expect.objectContaining({ id: 'tea-undated', dateAdded: T0, updated_at: T0 }),
            expect.objectContaining({ id: 'tea-dated', dateAdded: '2026-08-15T10:00:00.000Z', updated_at: '2026-11-02T00:00:00.000Z' }),
        ])
        expect(server.row('teas', 'tea-on-server')).toEqual(onServer)
        expect(storedTeas().sort((a, b) => a.id.localeCompare(b.id))).toEqual([
            dated,
            onServer,
            { ...undated, dateAdded: T0 },
        ])
    })

    it('an edit to a tea stored without dateAdded dates it by its last write before the edit, not by the edit', async () => {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(DAY3))
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
        const undated = tea({ id: 'tea-undated', image_path: null, updated_at: T0 })
        localStorage.setItem('teas', JSON.stringify([undated]))
        useTeasStore.setState({ teas: [undated] })

        useTeasStore.getState().updateTea('tea-undated', { name: 'Renamed' })

        expect(useTeasStore.getState().teas[0]).toMatchObject({ name: 'Renamed', dateAdded: T0, updated_at: DAY3 })
        expect(storedTeas()[0]).toMatchObject({ name: 'Renamed', dateAdded: T0, updated_at: DAY3 })
        onLine.mockReturnValue(true)
        expect(await useTeasStore.getState().syncTeas()).toBe(true)
        expect(server.row('teas', 'tea-undated')).toMatchObject({ name: 'Renamed', dateAdded: T0, updated_at: DAY3 })
    })
})
