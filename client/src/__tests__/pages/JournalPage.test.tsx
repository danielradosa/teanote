import '@/lang'
import i18n from 'i18next'
import type { User } from '@supabase/supabase-js'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
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
async function addJournal({ brewId, rating, title = 'Morning cup' }: { brewId?: string; rating?: string; title?: string } = {}) {
    const form = newJournalForm()
    fireEvent.change(form.getByPlaceholderText(i18n.t('journal_form_name_p')), { target: { value: title } })
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

function journal(id: string, overrides: Partial<Journal> = {}): Journal {
    return {
        id,
        user_id: USER,
        teaId: tea.id,
        brew_preset_id: null,
        title: id,
        rating: null,
        content: 'notes',
        images: [],
        dateAdded: T0,
        updated_at: T0,
        deleted_at: null,
        ...overrides,
    }
}

/** Journals on this device and on the server alike. */
function given(journals: Journal[]) {
    server.seed('journals', journals as unknown as Row[])
    localStorage.setItem('journals', JSON.stringify(journals))
    useJournalsStore.setState({ journals })
}

/** Opens the edit form of the journal with that title, as a user does. */
function editForm(title: string) {
    const item = screen.getByText(title).closest('li') as HTMLElement
    fireEvent.click(item.querySelector('.btn-info') as HTMLElement)
    return within(document.querySelector('.edit-panel') as HTMLElement)
}

async function save(form: ReturnType<typeof editForm>) {
    fireEvent.click(form.getByRole('button', { name: i18n.t('journal_save_btn') }))
    await settle()
}

/** Each journal's rating by title, with a missing rating shown as undefined. */
function ratingsByTitle(journals: { id: string; title?: unknown; rating?: unknown }[]) {
    return Object.fromEntries(journals.map(j => [j.title, j.rating]))
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

describe('JournalPage: the rating the journal form submits (none, or a whole number from 1 to 5)', () => {
    it('a new journal is saved with no rating (null) or with what was typed brought into 1 to 5 and rounded', async () => {
        render(<JournalPage />)
        const typed: [title: string, rating: string | undefined][] = [
            ['none typed', undefined],
            ['typed 0', '0'],
            ['typed -3', '-3'],
            ['typed 7', '7'],
            ['typed 99999999999', '99999999999'],
            ['typed 2.4', '2.4'],
            ['typed 4.5', '4.5'],
            ['typed 3', '3'],
        ]
        for (const [title, rating] of typed) await addJournal({ title, rating })

        const expected = {
            'none typed': null,
            'typed 0': 1,
            'typed -3': 1,
            'typed 7': 5,
            'typed 99999999999': 5,
            'typed 2.4': 2,
            'typed 4.5': 5,
            'typed 3': 3,
        }
        expect(ratingsByTitle(useJournalsStore.getState().journals)).toStrictEqual(expected)
        expect(ratingsByTitle(storedJournals())).toStrictEqual(expected)
        expect(ratingsByTitle(server.rows('journals'))).toStrictEqual(expected)
        expect(useSyncStore.getState().justSynced).toBe(true)
    })

    it("an edit saves a typed rating within 1 to 5; a rating an older version stored is kept unless the user types into it, and a journal nobody edits keeps its own", async () => {
        given([
            journal('j-typed', { title: 'Typed into', rating: 4 }),
            journal('j-older', { title: 'Older rating', rating: 7 }),
            journal('j-untouched', { title: 'Untouched', rating: 8 }),
        ])
        render(<JournalPage />)

        const typedInto = editForm('Typed into')
        fireEvent.change(typedInto.getByPlaceholderText(i18n.t('journal_form_rating_p')), { target: { value: '9' } })
        await save(typedInto)

        const renamed = editForm('Older rating')
        fireEvent.change(renamed.getByPlaceholderText(i18n.t('journal_form_name_p')), { target: { value: 'Older rating, renamed' } })
        await save(renamed)

        const expected = { 'Typed into': 5, 'Older rating, renamed': 7, Untouched: 8 }
        expect(ratingsByTitle(useJournalsStore.getState().journals)).toStrictEqual(expected)
        expect(ratingsByTitle(storedJournals())).toStrictEqual(expected)
        expect(ratingsByTitle(server.rows('journals'))).toStrictEqual(expected)
        const written = server.writes.filter(w => w.table === 'journals').map(w => (w.payload as Row[])[0].id)
        expect(written).toEqual(['j-typed', 'j-older'])
    })

    it('clearing the rating saves "no rating" as null, and the next sync does not bring the old rating back', async () => {
        given([journal('j-rated', { title: 'Rated', rating: 4 })])
        render(<JournalPage />)

        const form = editForm('Rated')
        fireEvent.change(form.getByPlaceholderText(i18n.t('journal_form_rating_p')), { target: { value: '' } })
        await save(form)

        expect(useJournalsStore.getState().journals[0].rating).toBeNull()
        expect(storedJournals()[0].rating).toBeNull()
        const upserts = server.writes.filter(w => w.table === 'journals' && w.op === 'upsert')
        expect(upserts).toHaveLength(1)
        expect((upserts[0].payload as Row[])[0]).toHaveProperty('rating', null)
        expect(server.row('journals', 'j-rated')?.rating).toBeNull()

        await act(() => useJournalsStore.getState().syncJournals())
        expect(useJournalsStore.getState().journals[0].rating).toBeNull()
        expect(storedJournals()[0].rating).toBeNull()
    })
})
