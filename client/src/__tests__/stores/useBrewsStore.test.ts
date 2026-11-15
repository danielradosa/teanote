import type { User } from '@supabase/supabase-js'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import type { Preset } from '@/types/Brew'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const T0 = '2026-09-01T08:00:00.000Z'

function preset(id: string, overrides: Partial<Preset> = {}): Preset {
    return {
        id,
        user_id: USER,
        name: `Preset ${id}`,
        teaId: null,
        teaType: 'green',
        infusionsAmount: 3,
        infusionTimes: [10, 15, 20],
        created_at: T0,
        updated_at: T0,
        deleted_at: null,
        ...overrides,
    }
}

function storedPresets(): Preset[] {
    return JSON.parse(localStorage.getItem('presets') ?? '[]')
}

function presetWrites() {
    return server.writes.filter(w => w.table === 'presets')
}

async function syncsDone() {
    await vi.waitFor(() => expect(useSyncStore.getState().activeSyncs).toBe(0))
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    useAuthStore.setState({ user: { id: USER } as User })
    useSyncStore.setState(useSyncStore.getInitialState())
    useBrewsStore.setState({ brews: [], presets: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'onLine')
})

describe('useBrewsStore: presets the integer[] infusionTimes column accepts', () => {
    it('a preset added or edited with fractional infusion times is stored and sent in whole seconds', async () => {
        // What PresetForm passes for "10, 12.5, 20".
        useBrewsStore.getState().addPreset({ name: 'Gongfu', teaType: 'oolong', infusionsAmount: 3, infusionTimes: [10, 12.5, 20] })
        const [added] = useBrewsStore.getState().presets
        expect(added.infusionTimes).toEqual([10, 13, 20])
        await syncsDone()
        expect(server.row('presets', added.id)).toMatchObject({ name: 'Gongfu', infusionTimes: [10, 13, 20] })
        expect(useSyncStore.getState().justSynced).toBe(true)

        // What PresetEditForm passes for "10.4, 15, 20".
        useBrewsStore.getState().updatePreset(added.id, {
            name: 'Gongfu',
            teaId: undefined,
            teaType: 'oolong',
            infusionsAmount: 3,
            infusionTimes: [10.4, 15, 20],
        })
        expect(storedPresets()[0].infusionTimes).toEqual([10, 15, 20])
        await syncsDone()
        expect(server.row('presets', added.id)).toMatchObject({ infusionTimes: [10, 15, 20] })
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it('a stored preset with a fractional infusion time is sent once in whole seconds; one the server has is left alone', async () => {
        const stuck = preset('p-half', { infusionTimes: [10, 12.5, 20] })
        const onServer = preset('p-ok')
        server.seed('presets', [onServer] as unknown as Row[])
        localStorage.setItem('presets', JSON.stringify([stuck, onServer]))
        useBrewsStore.setState({ presets: [stuck, onServer] })

        const first = await useBrewsStore.getState().syncPresets()
        const second = await useBrewsStore.getState().syncPresets()

        expect([first, second]).toEqual([true, true])
        expect(presetWrites().map(w => (w.payload as Row[])[0].id)).toEqual([stuck.id])
        const repaired = { ...stuck, infusionTimes: [10, 13, 20] }
        expect(server.row('presets', stuck.id)).toEqual(repaired)
        expect(server.row('presets', onServer.id)).toEqual(onServer)
        expect(storedPresets().sort((a, b) => a.id.localeCompare(b.id))).toEqual([repaired, onServer])
    })
})
