import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export default function PublicRoute({ children }: { children: React.ReactNode }) {
    const { user, access, initialized } = useAuthStore()

    if (!initialized) return null
    if (user && access === 'allowed') return <Navigate to="/" replace />

    return <>{children}</>
}