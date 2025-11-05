import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, access, initialized } = useAuthStore()
    const location = useLocation()

    if (!initialized) return null

    if (!user || access === 'denied') {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}