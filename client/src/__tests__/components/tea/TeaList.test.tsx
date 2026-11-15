import '@/lang'
import i18n from 'i18next'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { fakeSupabase as server, type SignCall } from '@/__tests__/support/fakeSupabase'
import TeaList from '@/components/tea/TeaList'
import type { Tea } from '@/types/Tea'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

// Signed links live in memory for the page session, so each test uses paths of its own.
let run = 0
let photoPath = ''

const STALE = 'https://abc.supabase.co/storage/v1/object/sign/teas/user-1/old.jpg?token=expired'
const EXTERNAL = 'https://shop.example/tea.png'

function teas(): Tea[] {
    return [
        { id: 'tea-2', name: 'Uploaded', type: 'green', inventory: '', image_path: photoPath, image: STALE, updated_at: '2026-11-01T00:00:00.000Z', deleted_at: null },
        { id: 'tea-1', name: 'External', type: 'oolong', inventory: '', image: EXTERNAL, updated_at: '2026-11-01T00:00:00.000Z', deleted_at: null },
    ]
}

function openAllDetails() {
    for (const button of screen.getAllByRole('button', { name: new RegExp(i18n.t('general_see_details')) })) {
        fireEvent.click(button)
    }
}

function signedBatch(call: SignCall) {
    return {
        data: call.paths.map(p => ({ path: p, error: null, signedUrl: `https://storage.test/teas/${p}?fresh` })),
        error: null,
    }
}

beforeEach(() => {
    server.reset()
    localStorage.clear()
    photoPath = `user-${++run}/photo.jpg`
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TeaList photos', () => {
    it('shows an uploaded photo through its path-derived link and never the stale tea.image', async () => {
        let answer!: () => void
        server.signer = call => new Promise(resolve => { answer = () => resolve(signedBatch(call)) })

        render(<TeaList teas={teas()} deleteTea={() => {}} onEdit={() => {}} />)
        openAllDetails()

        // Not signed yet: the uploaded tea shows no picture at all, the external one shows as before.
        expect(screen.queryByAltText('Uploaded')).toBeNull()
        expect(screen.getByAltText('External')).toHaveAttribute('src', EXTERNAL)
        expect(document.querySelector(`img[src="${STALE}"]`)).toBeNull()

        await act(async () => { answer() })

        expect(server.signCalls.map(c => c.paths)).toEqual([[photoPath]])
        expect(screen.getByAltText('Uploaded')).toHaveAttribute('src', `https://storage.test/teas/${photoPath}?fresh`)
        expect(screen.getByAltText('External')).toHaveAttribute('src', EXTERNAL)
        expect(document.querySelector(`img[src="${STALE}"]`)).toBeNull()
    })

    it('renders the tea without a picture, and throws nothing, when signing fails', async () => {
        server.signer = async () => ({ data: null, error: { message: 'storage unavailable' } })
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        render(<TeaList teas={teas()} deleteTea={() => {}} onEdit={() => {}} />)
        await act(async () => {})
        openAllDetails()

        const item = screen.getByText('Uploaded').closest('li')!
        expect(within(item).queryByRole('img')).toBeNull()
        expect(document.querySelector(`img[src="${STALE}"]`)).toBeNull()
        expect(screen.getByAltText('External')).toHaveAttribute('src', EXTERNAL)
    })

    it('renders the tea without a picture offline, and signs when the list is shown again online', async () => {
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

        const first = render(<TeaList teas={teas()} deleteTea={() => {}} onEdit={() => {}} />)
        await act(async () => {})
        openAllDetails()
        expect(screen.queryByAltText('Uploaded')).toBeNull()
        expect(server.signCalls).toHaveLength(0)
        first.unmount()

        onLine.mockReturnValue(true)
        render(<TeaList teas={teas()} deleteTea={() => {}} onEdit={() => {}} />)
        await act(async () => {})
        openAllDetails()

        expect(server.signCalls).toHaveLength(1)
        expect(screen.getByAltText('Uploaded')).toHaveAttribute('src', expect.stringContaining(photoPath))
    })
})
