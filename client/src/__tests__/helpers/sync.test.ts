import type { User } from '@supabase/supabase-js'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useTeasStore } from '@/stores/useTeasStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import type { Tea } from '@/types/Tea'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const T0 = '2026-11-01T00:00:00.000Z'
const T1 = '2026-11-02T00:00:00.000Z'
const T2 = '2026-11-03T00:00:00.000Z'

function tea(id: string, overrides: Partial<Tea> = {}): Tea {
    return { id, user_id: USER, name: `Tea ${id}`, type: 'green', inventory: '', updated_at: T0, deleted_at: null, ...overrides }
}

function local(teas: Tea[]) {
    localStorage.setItem('teas', JSON.stringify(teas))
    useTeasStore.setState({ teas })
}

function remote(teas: Tea[]) {
    server.seed('teas', teas as unknown as Row[])
}

function storedTeas(): Tea[] {
    return JSON.parse(localStorage.getItem('teas') ?? '[]')
}

const rejected = { message: 'new row violates row-level security policy' }

async function settle() {
    for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0))
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    useAuthStore.setState({ user: { id: USER } as User })
    useSyncStore.setState(useSyncStore.getInitialState())
    useTeasStore.setState({ teas: [] })
    useJournalsStore.setState({ journals: [] })
    useBrewsStore.setState({ brews: [], presets: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('sync: write failures (D2)', () => {
    it('a rejected upsert makes the sync report failure, keeps local data, and keeps the rows that did go through', async () => {
        local([tea('a', { name: 'edited here', updated_at: T1 }), tea('b', { updated_at: T1 })])
        remote([tea('a'), tea('b')])
        server.failWrite = (call, row) => (call.op === 'upsert' && row?.id === 'a' ? rejected : null)

        const synced = await useTeasStore.getState().syncTeas()

        expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, justSynced: false, lastSync: null })
        expect(storedTeas().find(t => t.id === 'a')).toMatchObject({ name: 'edited here', updated_at: T1 })
        expect(useTeasStore.getState().teas.find(t => t.id === 'a')).toMatchObject({ name: 'edited here' })
        expect(server.row('teas', 'b')?.updated_at).toBe(T1)
        expect(server.row('teas', 'a')?.name).toBe('Tea a')
        expect(synced).toBe(false)
    })

    it('a later sync retries what is still newer locally', async () => {
        local([tea('a', { name: 'edited here', updated_at: T1 })])
        remote([tea('a')])
        server.failWrite = () => rejected
        await useTeasStore.getState().syncTeas()

        server.failWrite = () => null
        const synced = await useTeasStore.getState().syncTeas()

        expect(server.row('teas', 'a')).toMatchObject({ name: 'edited here', updated_at: T1 })
        expect(useSyncStore.getState().justSynced).toBe(true)
        expect(synced).toBe(true)
    })

    it('a sync whose pull fails reports failure and writes nothing', async () => {
        local([tea('a', { updated_at: T1 })])
        server.failRead = () => ({ message: 'Failed to fetch' })

        const synced = await useTeasStore.getState().syncTeas()

        expect(server.writes).toEqual([])
        expect(storedTeas()).toHaveLength(1)
        expect(useSyncStore.getState().justSynced).toBe(false)
        expect(synced).toBe(false)
    })

    it("the sync indicator does not show success when one table's sync failed and another finished after it", async () => {
        const { startSync, finishSync } = useSyncStore.getState()
        startSync()
        startSync()
        finishSync(false)
        finishSync(true)

        expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, justSynced: false, lastSync: null })

        // The next round starts clean.
        startSync()
        finishSync(true)
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it("a mutation's background sync that fails raises no unhandled rejection", async () => {
        const unhandled = vi.fn()
        process.on('unhandledRejection', unhandled)
        try {
            local([tea('a')])
            server.failRead = () => ({ message: 'Failed to fetch' })
            useTeasStore.getState().addTea({ name: 'New', type: 'green', inventory: '' })
            useTeasStore.getState().updateTea('a', { name: 'Renamed', image_path: null })
            useJournalsStore.getState().addJournal({ title: 'Note', teaId: 'a', content: 'x' })
            await settle()

            server.failRead = () => null
            server.failWrite = () => rejected
            useBrewsStore.getState().addPreset({ name: 'Quick', infusionsAmount: 3, infusionTimes: [10, 15, 20] })
            const brewId = useBrewsStore.getState().addBrew({ teaId: 'a' })
            useBrewsStore.getState().addInfusion(brewId as string, { actualTime: 12 })
            useTeasStore.getState().deleteTea('a')
            await settle()

            vi.spyOn(server.client, 'from').mockImplementation(() => { throw new TypeError('fetch failed') })
            useJournalsStore.getState().deleteJournal(useJournalsStore.getState().journals[0].id)
            useBrewsStore.getState().deleteBrew(brewId as string)
            await settle()
        } finally {
            process.off('unhandledRejection', unhandled)
        }

        expect(unhandled).not.toHaveBeenCalled()
        expect(useSyncStore.getState()).toMatchObject({ activeSyncs: 0, isSyncing: false, justSynced: false })
    })
})

describe('sync: tombstones (D3)', () => {
    it('sends a tombstone only for a row the server has and has not already marked deleted', async () => {
        local([
            tea('a', { deleted_at: T0, updated_at: T0 }), // the server already has this tombstone
            tea('b', { deleted_at: T1, updated_at: T1 }), // deleted here, live on the server
            tea('c', { deleted_at: T1, updated_at: T1 }), // created and deleted here, never on the server
        ])
        remote([tea('a', { deleted_at: T0 }), tea('b')])

        const synced = await useTeasStore.getState().syncTeas()

        expect(server.writes.map(w => [w.op, w.filters])).toEqual([
            ['update', [['id', 'b'], ['user_id', USER]]],
        ])
        expect(server.row('teas', 'b')?.deleted_at).toBe(T1)
        expect(server.row('teas', 'c')).toBeUndefined()
        expect(synced).toBe(true)

        // A second sync has nothing left to send.
        server.writes = []
        await useTeasStore.getState().syncTeas()
        expect(server.writes).toEqual([])
    })

    it('keeps a tombstone the server rejected on this device and sends it again on the next sync', async () => {
        local([tea('b', { deleted_at: T1, updated_at: T1 })])
        remote([tea('b')])
        server.failWrite = call => (call.op === 'update' ? rejected : null)

        const first = await useTeasStore.getState().syncTeas()
        expect(storedTeas()).toEqual([expect.objectContaining({ id: 'b', deleted_at: T1 })])
        expect(useSyncStore.getState().justSynced).toBe(false)

        // Even after a reload the next sync must not bring the row back.
        server.failWrite = () => null
        useTeasStore.setState({ teas: storedTeas() })
        const second = await useTeasStore.getState().syncTeas()
        expect(server.row('teas', 'b')?.deleted_at).toBe(T1)
        expect(useTeasStore.getState().visibleTeas()).toEqual([])
        expect([first, second]).toEqual([false, true])
    })
})

describe('sync: paged pull (D4)', () => {
    const ids = ['01', '02', '03', '04', '05', '06', '07', '08']

    it('pulls a table larger than the server row cap completely, in a stable order, and resurrects nothing', async () => {
        server.maxRows = 3
        // Stored on the server in an order that is not the id order.
        remote([...ids].reverse().map(id => tea(id, id === '06' ? { deleted_at: T1, updated_at: T1 } : {})))
        // This device still has 06 live from before it was deleted elsewhere.
        local(ids.map(id => tea(id)))

        const synced = await useTeasStore.getState().syncTeas()

        expect(server.writes).toEqual([])
        expect(server.row('teas', '06')?.deleted_at).toBe(T1)
        expect(server.reads.every(r => r.order?.column === 'id' && r.order.ascending)).toBe(true)
        expect(server.reads.map(r => r.from)).toEqual([0, 3, 6, 8])
        const teas = useTeasStore.getState().teas
        expect(teas.map(t => t.id).sort()).toEqual(ids)
        expect(teas.find(t => t.id === '06')?.deleted_at).toBe(T1)
        expect(useTeasStore.getState().visibleTeas().map(t => t.id).sort()).toEqual(ids.filter(id => id !== '06'))
        expect(synced).toBe(true)
    })

    it('uploads a local row the server does not have, after reading every page', async () => {
        server.maxRows = 3
        remote(ids.map(id => tea(id)))
        local([...ids.map(id => tea(id)), tea('09', { updated_at: T2 })])

        const synced = await useTeasStore.getState().syncTeas()

        expect(server.writes.map(w => [w.op, (w.payload as Row[])[0].id])).toEqual([['upsert', '09']])
        expect(synced).toBe(true)
    })

    it('when a later page fails, the sync fails and writes nothing', async () => {
        server.maxRows = 3
        remote(ids.map(id => tea(id)))
        local(ids.map(id => tea(id)))
        server.failRead = () => (server.reads.length > 1 ? { message: 'upstream timeout' } : null)

        const synced = await useTeasStore.getState().syncTeas()

        expect(server.writes).toEqual([])
        expect(storedTeas()).toHaveLength(ids.length)
        expect(synced).toBe(false)
    })
})
