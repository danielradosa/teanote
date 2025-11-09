import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isSubscribed, subscriptionEnd, trialDaysLeft, initialized } = useAuthStore()
    const location = useLocation()

    if (!initialized) return null

    const now = new Date()
    const subEndDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const hasActiveSubscription = isSubscribed && subEndDate && subEndDate > now
    const hasTrial = trialDaysLeft !== null && trialDaysLeft > 0

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (!hasActiveSubscription && !hasTrial && location.pathname !== '/account') {
        return <Navigate to="/account" replace />
    }

    return <>{children}</>
}