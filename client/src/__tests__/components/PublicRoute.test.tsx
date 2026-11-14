import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import PublicRoute from '@/components/PublicRoute'
import { useAuthStore } from '@/stores/useAuthStore'

vi.mock('@/utils/supa', () => ({
    default: {
        auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    },
}))

const signedInUser = { id: 'user-1', email: 'tea@example.com' } as User

function WhereAmI() {
    const location = useLocation()
    return <p>at {location.pathname + location.search + location.hash}</p>
}

function renderLogin(state?: unknown) {
    return render(
        <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
            <Routes>
                <Route path="/login" element={<PublicRoute><p>login page</p></PublicRoute>} />
                <Route path="*" element={<WhereAmI />} />
            </Routes>
        </MemoryRouter>
    )
}

// The shape ProtectedRoute leaves in state when it sends a signed-out user to /login.
const fromBrews = { from: { pathname: '/brews', search: '?view=presets', hash: '#latest', state: null, key: 'abc' } }

describe('PublicRoute', () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, session: null, initialized: true })
    })

    it('sends a signed-in user to the path ProtectedRoute remembered', () => {
        useAuthStore.setState({ user: signedInUser })

        renderLogin(fromBrews)

        expect(screen.getByText('at /brews?view=presets#latest')).toBeInTheDocument()
        expect(screen.queryByText('login page')).not.toBeInTheDocument()
    })

    it('sends the user to the remembered path once they sign in on the page', () => {
        renderLogin(fromBrews)
        expect(screen.getByText('login page')).toBeInTheDocument()

        act(() => useAuthStore.setState({ user: signedInUser }))

        expect(screen.getByText('at /brews?view=presets#latest')).toBeInTheDocument()
    })

    it('sends a signed-in user without a remembered path to /', () => {
        useAuthStore.setState({ user: signedInUser })

        renderLogin()

        expect(screen.getByText('at /')).toBeInTheDocument()
    })

    it.each([
        ['a full URL string', { from: 'https://evil.example/brews' }],
        ['a protocol-relative path', { from: { pathname: '//evil.example/brews' } }],
        ['a backslash path', { from: { pathname: '/\\evil.example/brews' } }],
        ['a full URL as the path', { from: { pathname: 'https://evil.example/brews' } }],
    ])('ignores %s and sends a signed-in user to /', (_label, state) => {
        useAuthStore.setState({ user: signedInUser })

        renderLogin(state)

        expect(screen.getByText('at /')).toBeInTheDocument()
    })

    it('renders the page for a signed-out user', () => {
        renderLogin(fromBrews)

        expect(screen.getByText('login page')).toBeInTheDocument()
    })

    it('renders nothing until auth is initialized', () => {
        useAuthStore.setState({ user: signedInUser, initialized: false })

        const { container } = renderLogin(fromBrews)

        expect(container).toBeEmptyDOMElement()
    })
})
