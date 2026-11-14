import { Navigate, useLocation } from 'react-router-dom'
import type { Location, To } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'

// ProtectedRoute leaves the location it turned away in state.from. Use only its
// path, search and hash, and only when the path stays inside this app.
function rememberedPath(state: unknown): To {
    const from = (state as { from?: Partial<Location> } | null)?.from
    const pathname = from?.pathname
    if (typeof pathname !== 'string' || !pathname.startsWith('/')) return '/'
    try {
        // "//host" or "/\host" would resolve to another site.
        if (new URL(pathname, window.location.origin).origin !== window.location.origin) return '/'
    } catch {
        return '/'
    }
    return {
        pathname,
        search: typeof from?.search === 'string' ? from.search : '',
        hash: typeof from?.hash === 'string' ? from.hash : '',
    }
}

export default function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, initialized } = useAuthStore()
    const location = useLocation()

    if (!initialized) return null
    if (user) return <Navigate to={rememberedPath(location.state)} replace />

    return <>{children}</>
}
