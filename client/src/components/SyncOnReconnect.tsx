import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTeasStore } from '@/stores/useTeasStore'
import { useJournalsStore } from '@/stores/useJournalsStore'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { initAllRealtime, stopAllRealtime } from '@/helpers/realtimeStores'
import { t } from 'i18next'

function SyncOnReconnect() {
    const { syncTeas } = useTeasStore()
    const { syncJournals } = useJournalsStore()
    const { syncBrews, syncPresets } = useBrewsStore()
    const { syncSettings } = useSettingsStore()
    // The store swaps in a new user object on every auth event (token refresh
    // included); the sync below only needs to restart when the account changes.
    const userId = useAuthStore((s) => s.user?.id)
    const [status, setStatus] = useState<'offline' | 'syncing' | 'online' | null>(null)

    useEffect(() => {
        if (!userId) return

        const doSync = async () => {
            setStatus('syncing')
            setStatus('online')
            try {
                const results = await Promise.all([
                    syncTeas(),
                    syncJournals(),
                    syncBrews(),
                    syncPresets(),
                    syncSettings(),
                ])
                // A table whose pull or writes failed reports false; one toast covers the round.
                if (results.includes(false)) toast.error(t('sync_failed_toast'), { duration: 4000 })
            } catch (err) {
                console.error('❌ Sync error:', err)
                toast.error(t('sync_failed_toast'), { duration: 4000 })
                setStatus('offline')
            } finally {
                setTimeout(() => setStatus(null), 2000)
            }
        }

        doSync()
        initAllRealtime()

        function handleOnline() {
            doSync()
        }

        function handleOffline() {
            setStatus('offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const interval = setInterval(() => {
            if (navigator.onLine) doSync()
        }, 5 * 60 * 1000)

        if (!navigator.onLine) handleOffline()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            clearInterval(interval)
            stopAllRealtime()
        }
    }, [userId, syncTeas, syncJournals, syncBrews, syncPresets, syncSettings])

    if (!status) return null

    return (
        <div style={{
            textAlign: 'center',
            marginTop: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <small className='synced-at'>
                {status === 'offline' && `❌ ${t('sidebar_connection_lost')}`}
                {status === 'online' && `🌐 ${t('sidebar_connection_back')}`}
            </small>
        </div>
    )
}

export default SyncOnReconnect
