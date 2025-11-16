'use client'

import { Link } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'
import { useSyncStore } from '../../stores/useSyncStore'
import Loader from '../Loader'
import SyncOnReconnect from '../SyncOnReconnect'
import { t } from 'i18next';

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
                    <Link to="/" className="btn btn-sidebar">🏠 {t("sidebar_link_home")}</Link>
                    <Link to="/teas" className="btn btn-sidebar">🍃 {t("sidebar_link_teas")}</Link>
                    <Link to="/journal" className="btn btn-sidebar">📔 {t("sidebar_link_journal")}</Link>
                    <Link to="/brews" className="btn btn-sidebar">⏱️ {t("sidebar_link_brews")}</Link>
                    <Link to="/settings" className="btn btn-sidebar">⚙️ {t("sidebar_link_settings")}</Link>
                </>
            ) : null}
            <Link to="/account" className="btn btn-sidebar hide-mobile">👨🏻‍🔧 {t("sidebar_link_account")}</Link>

            <footer className="sidebar-footer">
                {isSyncing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
                        <Loader size={16} inline={true} color='var(--text-color)' />
                        <small className='synced-at'>{t("sidebar_text_syncing")}...</small>
                    </div>
                ) : justSynced ? (
                    <small className="synced-at">✅ {t("sidebar_text_just_synced")}</small>
                ) : (
                    lastSync && <small className='synced-at'>{t("sidebar_text_synced_at")} {new Date(lastSync).toLocaleTimeString()}</small>
                )}
                <SyncOnReconnect />
            </footer>
        </aside>
    )
}

export default DesktopSidebar