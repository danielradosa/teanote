'use client'

import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

function DesktopNav() {
    const { signOut, trialDaysLeft, isSubscribed, subscriptionEnd } = useAuthStore()
    const navigate = useNavigate()

    const now = new Date()
    const subEndDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const hasActiveSubscription = isSubscribed && subEndDate && subEndDate > now
    const hasTrial = trialDaysLeft !== null && trialDaysLeft > 0
    const canAccessApp = hasActiveSubscription || hasTrial

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="main-header">
            <div className="logo">
                <Link to="/">🍵 Teanote</Link>
                <span className='trial-badge'>
                    {hasActiveSubscription
                        ? 'ACTIVE SUBSCRIPTION ✅'
                        : hasTrial
                            ? `TRIAL ${trialDaysLeft}d left ⏳`
                            : 'TRIAL / SUBSCRIPTION EXPIRED ⚠️'}
                </span>
            </div>
            <nav>
                {canAccessApp && (
                    <>
                        <Link to="/brews">
                            <button className="btn btn-action">⏳ Start brew</button>
                        </Link>
                        <Link to="/journal">
                            <button className="btn btn-action">📔 Journal</button>
                        </Link>
                    </>
                )}
                <button className="btn btn-action logout-btn" onClick={handleLogout}>
                    Log out
                </button>
            </nav>
        </header>
    )
}

export default DesktopNav