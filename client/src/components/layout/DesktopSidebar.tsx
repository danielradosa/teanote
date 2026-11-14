import { NavLink } from 'react-router-dom'
import { useSyncStore } from '@/stores/useSyncStore'
import MobileMoreLinks from '@/components/layout/MobileMoreLinks'
import SyncOnReconnect from '@/components/SyncOnReconnect'
import { t } from 'i18next'

function DesktopSidebar() {
    const { isSyncing, justSynced, lastSync } = useSyncStore()

    return (
        <aside className="sidebar">
            <NavLink to="/" end className="btn btn-sidebar hide-mobile">🏠 {t('sidebar_link_home')}</NavLink>
            <NavLink to="/teas" className="btn btn-sidebar">🍃 {t('sidebar_link_teas')}</NavLink>
            <NavLink to="/journal" className="btn btn-sidebar">📔 {t('sidebar_link_journal')}</NavLink>
            <NavLink to="/brews" className="btn btn-sidebar">⏱️ {t('sidebar_link_brews')}</NavLink>
            <MobileMoreLinks />
            <NavLink to="/settings" className="btn btn-sidebar hide-mobile">⚙️ {t('sidebar_link_settings')}</NavLink>
            <NavLink to="/account" className="btn btn-sidebar hide-mobile">👨🏻‍🔧 {t('sidebar_link_account')}</NavLink>

            <footer className="sidebar-footer">
                {isSyncing ? (
                    <div className="sync-status">
                        <span className="sync-wave" aria-hidden="true" />
                        <small className='synced-at'>{t('sidebar_text_syncing')}...</small>
                    </div>
                ) : justSynced ? (
                    <small className="synced-at">✅ {t('sidebar_text_just_synced')}</small>
                ) : (
                    lastSync && <small className='synced-at'>{t('sidebar_text_synced_at')} {new Date(lastSync).toLocaleTimeString()}</small>
                )}
                <SyncOnReconnect />
            </footer>
        </aside>
    )
}

export default DesktopSidebar
