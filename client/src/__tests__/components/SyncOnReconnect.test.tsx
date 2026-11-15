import '@/lang'
import i18n from 'i18next'
import toast from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'
import { act, render } from '@testing-library/react'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import SyncOnReconnect from '@/components/SyncOnReconnect'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useTeasStore } from '@/stores/useTeasStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import type { Tea } from '@/types/Tea'
import type { Journal } from '@/types/Journal'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }))

const USER = 'user-1'
const T1 = '2026-11-02T00:00:00.000Z'

const rejected = { message: 'new row violates row-level security policy' }

async function settle() {
    for (let i = 0; i < 30; i++) {
        await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    }
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    vi.mocked(toast.error).mockClear()
    useAuthStore.setState({ user: { id: USER } as User })
    useSyncStore.setState(useSyncStore.getInitialState())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const teas: Tea[] = [
        { id: 'tea-1', user_id: USER, name: 'Sencha', type: 'green', inventory: '', updated_at: T1, deleted_at: null },
        { id: 'tea-2', user_id: USER, name: 'Gyokuro', type: 'green', inventory: '', updated_at: T1, deleted_at: null },
    ]
    const journals: Journal[] = [
        { id: 'j-1', user_id: USER, teaId: 'tea-1', title: 'Morning', content: 'grassy', updated_at: T1, deleted_at: null },
    ]
    localStorage.setItem('teas', JSON.stringify(teas))
    localStorage.setItem('journals', JSON.stringify(journals))
    useTeasStore.setState({ teas })
    useJournalsStore.setState({ journals })
    useBrewsStore.setState({ brews: [], presets: [] })
    server.seed('settings', [{ id: 'settings-1', user_id: USER, theme: 'Teanote Default', ai_enabled: false, language: 'en' }] as Row[])
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('SyncOnReconnect', () => {
    it('shows one sync_failed_toast for a round in which writes of several rows and tables were rejected', async () => {
        server.failWrite = (call) => (call.table === 'teas' || call.table === 'journals' ? rejected : null)

        const view = render(<SyncOnReconnect />)
        await settle()

        expect(server.writes.filter(w => w.table === 'teas')).toHaveLength(2)
        expect(server.writes.filter(w => w.table === 'journals')).toHaveLength(1)
        expect(toast.error).toHaveBeenCalledTimes(1)
        expect(toast.error).toHaveBeenCalledWith(i18n.t('sync_failed_toast'), expect.anything())
        expect(useSyncStore.getState()).toMatchObject({ isSyncing: false, justSynced: false, lastSync: null })
        expect(JSON.parse(localStorage.getItem('teas')!)).toHaveLength(2)

        // The next round (here: the device comes back online) gets its own single toast.
        await act(async () => { window.dispatchEvent(new Event('online')) })
        await settle()
        expect(toast.error).toHaveBeenCalledTimes(2)

        view.unmount()
    })

    it('shows no toast when every write went through', async () => {
        const view = render(<SyncOnReconnect />)
        await settle()

        expect(server.writes.filter(w => w.table === 'teas')).toHaveLength(2)
        expect(toast.error).not.toHaveBeenCalled()
        expect(useSyncStore.getState().justSynced).toBe(true)

        view.unmount()
    })
})
