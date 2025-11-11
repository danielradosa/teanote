'use client'

import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSyncStore } from '../../stores/useSyncStore'
import Loader from '../Loader'
import SyncOnReconnect from '../SyncOnReconnect'

function DesktopSidebar() {
    const { isSubscribed, subscriptionEnd, trialDaysLeft } = useAuthStore()
    const { isSyncing, justSynced, lastSync } = useSyncStore()

    const now = new Date()
    const subEndDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const hasActiveSubscription = isSubscribed && subEndDate && subEndDate > now
    const hasTrial = trialDaysLeft !== null && trialDaysLeft > 0

    return (
        <aside className="sidebar">
            {hasActiveSubscription || hasTrial ? (
                <>
                    <Link to="/" className="btn btn-sidebar hide-mobile">🏠 Home</Link>
                    <Link to="/teas" className="btn btn-sidebar">🍃 Teas</Link>
                    <Link to="/journal" className="btn btn-sidebar">📔 Journal</Link>
                    <Link to="/brews" className="btn btn-sidebar">⏱️ Brews</Link>
                    <Link to="/settings" className="btn btn-sidebar hide-mobile">⚙️ Settings</Link>
                </>
            ) : null}
            <Link to="/account" className="btn btn-sidebar">👨🏻‍🔧 Account</Link>

            <footer className="sidebar-footer">
                {isSyncing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                        <Loader size={16} inline={true} color='white' />
                        <small>Syncing…</small>
                    </div>
                ) : justSynced ? (
                    <small className="text-green-500">✅ Synced</small>
                ) : (
                    lastSync && <small>Synced at {new Date(lastSync).toLocaleTimeString()}</small>
                )}
                <SyncOnReconnect />
            </footer>
        </aside>
    )
}

export default DesktopSidebar