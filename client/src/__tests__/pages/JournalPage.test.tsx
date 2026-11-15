import '@/lang'
import i18n from 'i18next'
import type { User } from '@supabase/supabase-js'
import { act, fireEvent, render, within } from '@testing-library/react'
import { fakeSupabase as server } from '@/__tests__/support/fakeSupabase'
import JournalPage from '@/pages/JournalPage'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'
import { useTeasStore } from '@/stores/useTeasStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import type { Tea } from '@/types/Tea'
import type { Brew } from '@/types/Brew'
import type { Journal } from '@/types/Journal'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const T0 = '2026-11-01T00:00:00.000Z'

const tea: Tea = { id: 'tea-1', user_id: USER, name: 'Sencha', type: 'green', inventory: '', updated_at: T0, deleted_at: null }
const brew: Brew = {
    id: 'brew-1',
    user_id: USER,
    teaId: tea.id,
    startedAt: T0,
    infusions: [{ number: 1, actualTime: 30 }],
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
}

async function settle() {
    for (let i = 0; i < 20; i++) {
        await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    }
}

function newJournalForm() {
    return within(document.querySelector('.new-journal') as HTMLElement)
}

/** Fills in the new-journal form as a user does and presses "add journal". */
async function addJournal({ brewId, rating }: { brewId?: string; rating?: string } = {}) {
    const form = newJournalForm()
    fireEvent.change(form.getByPlaceholderText(i18n.t('journal_form_name_p')), { target: { value: 'Morning cup' } })
    const [brewSelect, teaSelect] = form.getAllByRole('combobox')
    if (brewId) fireEvent.change(brewSelect, { target: { value: brewId } })
    fireEvent.change(teaSelect, { target: { value: tea.id } })
    if (rating !== undefined) {
        fireEvent.change(form.getByPlaceholderText(i18n.t('journal_form_rating_p')), { target: { value: rating } })
    }
    fireEvent.change(form.getByPlaceholderText(i18n.t('journal_form_notes_p')), { target: { value: 'grassy, sweet' } })
    fireEvent.click(form.getByRole('button', { name: i18n.t('journal_add_btn') }))
    await settle()
}

function storedJournals(): Journal[] {
    return JSON.parse(localStorage.getItem('journals') ?? '[]')
}

beforeAll(async () => {
    if (!i18n.isInitialized) await new Promise<void>(resolve => i18n.on('initialized', () => resolve()))
})

beforeEach(() => {
    server.reset()
    localStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    useAuthStore.setState({ user: { id: USER } as User })
    useSyncStore.setState(useSyncStore.getInitialState())
    localStorage.setItem('teas', JSON.stringify([tea]))
    localStorage.setItem('brews', JSON.stringify([brew]))
    useTeasStore.setState({ teas: [tea] })
    useBrewsStore.setState({ brews: [brew], presets: [] })
    useJournalsStore.setState({ journals: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'onLine')
})

describe('JournalPage: a new journal reaches the server', () => {
    it('saved without choosing a brew, it is stored and sent with no brew (null), and the sync succeeds', async () => {
        render(<JournalPage />)
        await addJournal()

        const [saved] = useJournalsStore.getState().journals
        expect(saved.brew_preset_id).toBeNull()
        expect(storedJournals()[0].brew_preset_id).toBeNull()
        expect(server.row('journals', saved.id)).toMatchObject({
            title: 'Morning cup',
            teaId: tea.id,
            content: 'grassy, sweet',
            brew_preset_id: null,
        })
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it('saved with a brew chosen, it keeps that brew', async () => {
        render(<JournalPage />)
        await addJournal({ brewId: brew.id })

        const [saved] = useJournalsStore.getState().journals
        expect(saved.brew_preset_id).toBe(brew.id)
        expect(server.row('journals', saved.id)).toMatchObject({ title: 'Morning cup', brew_preset_id: brew.id })
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it('a rating typed as 3.5 is saved as a whole number, which the integer column takes', async () => {
        render(<JournalPage />)
        await addJournal({ brewId: brew.id, rating: '3.5' })

        const [saved] = useJournalsStore.getState().journals
        expect(saved.rating).toBe(4)
        expect(server.row('journals', saved.id)).toMatchObject({ rating: 4, brew_preset_id: brew.id })
        expect(useSyncStore.getState().justSynced).toBe(true)
    })
})
