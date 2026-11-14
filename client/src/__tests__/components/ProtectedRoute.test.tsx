import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuthStore } from '@/stores/useAuthStore'

vi.mock('@/utils/supa', () => ({
    default: {
        auth: { getSession: vi.fn(), onAuthStateChange: vi.fn(), signOut: vi.fn() },
    },
}))

const signedInUser = { id: 'user-1', email: 'tea@example.com' } as User

function LoginProbe() {
    const location = useLocation()
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    return <p>login page, from {from}</p>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/" element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
                    <Route path="brews" element={<p>brews page</p>} />
                    <Route path="account" element={<p>account page</p>} />
                </Route>
                <Route path="/login" element={<LoginProbe />} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        useAuthStore.setState({ user: null, session: null, initialized: true })
    })

    it('lets a signed-in user through to the child route', () => {
        useAuthStore.setState({ user: signedInUser })

        renderAt('/brews')

        expect(screen.getByText('brews page')).toBeInTheDocument()
        expect(screen.queryByText('account page')).not.toBeInTheDocument()
    })

    it('redirects a signed-out user to /login and remembers where they came from', () => {
        renderAt('/brews')

        expect(screen.getByText('login page, from /brews')).toBeInTheDocument()
        expect(screen.queryByText('brews page')).not.toBeInTheDocument()
    })

    it('renders nothing until auth is initialized', () => {
        useAuthStore.setState({ initialized: false })

        const { container } = renderAt('/brews')

        expect(container).toBeEmptyDOMElement()
    })
})
