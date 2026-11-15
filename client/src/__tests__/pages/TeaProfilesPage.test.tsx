import '@/lang'
import i18n from 'i18next'
import type { User } from '@supabase/supabase-js'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { fakeSupabase as server, type Row } from '@/__tests__/support/fakeSupabase'
import TeaProfilesPage from '@/pages/TeaProfilesPage'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTeasStore } from '@/stores/useTeasStore'
import type { Tea } from '@/types/Tea'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

const USER = 'user-1'
const STALE = 'https://abc.supabase.co/storage/v1/object/sign/teas/user-1/old.jpg?token=expired'
const T0 = '2026-11-01T00:00:00.000Z'

// Signed links stay in memory for the page session, so each test uses a photo path of its own.
let run = 0
let oldPath = ''

function savedTea(): Tea {
    return {
        id: 'tea-1',
        user_id: USER,
        name: 'Sencha',
        type: 'green',
        inventory: '',
        image: STALE,
        image_path: oldPath,
        updated_at: T0,
        deleted_at: null,
    }
}

function given(teas: Tea[]) {
    localStorage.setItem('teas', JSON.stringify(teas))
    useTeasStore.setState({ teas })
    server.seed('teas', teas as unknown as Row[])
    for (const t of teas) if (t.image_path) server.bucket('teas').add(t.image_path)
}

async function settle() {
    for (let i = 0; i < 20; i++) {
        await act(() => new Promise(resolve => setTimeout(resolve, 0)))
    }
}

function photo(name: string) {
    return new File(['x'], name, { type: 'image/png' })
}

async function upload(scope: HTMLElement, file: File) {
    const input = scope.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    await settle()
}

function button(scope: HTMLElement, key: string) {
    return within(scope).getByRole('button', { name: new RegExp(`^\\s*${i18n.t(key)}\\s*$`) })
}

function openEditor(): HTMLElement {
    const item = screen.getByText('Sencha').closest('li')!
    fireEvent.click(item.querySelector('.tea-actions .btn-info')!)
    return document.querySelector('.edit-panel') as HTMLElement
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    oldPath = `${USER}/old-${++run}.jpg`
    useAuthStore.setState({ user: { id: USER } as User })
    useTeasStore.setState({ teas: [] })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-preview')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TeaProfilesPage tea photos', () => {
    it('saves an uploaded photo by its path and never writes a signed link into the record or localStorage', async () => {
        render(<TeaProfilesPage />)
        const form = document.querySelector('.new-tea') as HTMLElement
        fireEvent.click(button(form, 'teas_add_details_btn'))

        await upload(form, photo('leaf.png'))
        fireEvent.change(within(form).getByPlaceholderText(i18n.t('teas_form_name_p')), { target: { value: 'Bai Mu Dan' } })
        fireEvent.click(button(form, 'teas_add_tea_btn'))
        await settle()

        const added = useTeasStore.getState().teas.find(t => t.name === 'Bai Mu Dan')!
        expect(added.image_path).toMatch(new RegExp(`^${USER}/[^/]+\\.png$`))
        expect(added.image ?? '').toBe('')
        expect(localStorage.getItem('teas')).not.toContain('https://storage.test')
        expect(JSON.stringify(server.rows('teas'))).not.toContain('https://storage.test')
    })

    it('previews the photo of an existing tea through its path-derived link, not the stale tea.image', async () => {
        given([savedTea()])
        render(<TeaProfilesPage />)
        const editor = openEditor()
        await settle()

        expect(within(editor).getByAltText('Tea Preview')).toHaveAttribute('src', `https://storage.test/teas/${oldPath}?sig=1`)
        expect(document.querySelector(`img[src="${STALE}"]`)).toBeNull()
    })

    it('removing the photo of an existing tea deletes the old file once the saved tea no longer points at it', async () => {
        given([savedTea()])
        let serverPathAtRemoval: unknown = 'not removed'
        server.onRemove = () => { serverPathAtRemoval = server.row('teas', 'tea-1')?.image_path }
        render(<TeaProfilesPage />)
        const editor = openEditor()

        fireEvent.click(button(editor, 'delete'))
        await settle()
        expect(server.removeCalls).toEqual([])

        fireEvent.click(button(editor, 'teas_save_tea_btn'))
        await settle()

        expect(server.row('teas', 'tea-1')?.image_path).toBeNull()
        expect(server.removeCalls).toEqual([{ bucket: 'teas', paths: [oldPath] }])
        expect(serverPathAtRemoval).toBeNull()
    })

    it('replacing the photo of an existing tea deletes the old file and any photo uploaded in between, and keeps the new one', async () => {
        given([savedTea()])
        render(<TeaProfilesPage />)
        const editor = openEditor()

        await upload(editor, photo('first.png'))
        const firstPath = [...server.bucket('teas')].find(p => p !== oldPath)!
        await upload(editor, photo('second.png'))
        const secondPath = [...server.bucket('teas')].find(p => p !== oldPath && p !== firstPath)!
        expect(server.removeCalls).toEqual([])

        fireEvent.click(button(editor, 'teas_save_tea_btn'))
        await settle()

        expect(server.row('teas', 'tea-1')?.image_path).toBe(secondPath)
        const removed = server.removeCalls.flatMap(c => c.paths).sort()
        expect(removed).toEqual([oldPath, firstPath].sort())
        expect([...server.bucket('teas')]).toEqual([secondPath])
    })

    describe('when another device changes the photo while the edit form is open', () => {
        const T1 = '2026-11-02T00:00:00.000Z'
        let otherPath = ''

        /** Another device replaces the photo, and a sync brings its copy of the tea here. */
        async function photoReplacedElsewhere() {
            otherPath = `${USER}/other-${run}.jpg`
            server.bucket('teas').add(otherPath)
            server.seed('teas', [{ ...savedTea(), image: '', image_path: otherPath, updated_at: T1 }] as unknown as Row[])
            await act(async () => { await useTeasStore.getState().syncTeas() })
            expect(useTeasStore.getState().teas[0].image_path).toBe(otherPath)
        }

        it('saving a text-only change deletes no photo', async () => {
            given([savedTea()])
            render(<TeaProfilesPage />)
            const editor = openEditor()
            await photoReplacedElsewhere()

            fireEvent.change(within(editor).getByPlaceholderText(i18n.t('teas_form_notes_p')), { target: { value: 'Grassy' } })
            fireEvent.click(button(editor, 'teas_save_tea_btn'))
            await settle()

            expect(server.removeCalls).toEqual([])
            expect(server.bucket('teas').has(otherPath)).toBe(true)
        })

        it('replacing the photo deletes only the one the form opened with', async () => {
            given([savedTea()])
            render(<TeaProfilesPage />)
            const editor = openEditor()
            await photoReplacedElsewhere()

            await upload(editor, photo('mine.png'))
            const minePath = [...server.bucket('teas')].find(p => p !== oldPath && p !== otherPath)!
            fireEvent.click(button(editor, 'teas_save_tea_btn'))
            await settle()

            expect(server.row('teas', 'tea-1')?.image_path).toBe(minePath)
            expect(server.removeCalls).toEqual([{ bucket: 'teas', paths: [oldPath] }])
            expect(server.bucket('teas').has(otherPath)).toBe(true)
        })
    })

    it('cancelling the edit deletes nothing that the saved tea uses', async () => {
        given([savedTea()])
        render(<TeaProfilesPage />)
        const editor = openEditor()

        fireEvent.click(button(editor, 'delete'))
        fireEvent.click(button(editor, 'teas_cancel_tea_btn'))
        await settle()

        expect(server.removeCalls).toEqual([])
        expect(useTeasStore.getState().teas[0].image_path).toBe(oldPath)
    })
})
