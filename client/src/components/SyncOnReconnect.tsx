import { useEffect, useState } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useAuthStore } from '../stores/useAuthStore'
import { initAllRealtime, stopAllRealtime } from '../helpers/realtimeStores'

function SyncOnReconnect() {
    const { syncTeas } = useTeasStore()
    const { syncJournals } = useJournalsStore()
    const { syncBrews, syncPresets } = useBrewsStore()
    const { syncSettings } = useSettingsStore()
    const { user, checkAccess } = useAuthStore()
    const [status, setStatus] = useState<'offline' | 'syncing' | 'online' | null>(null)

    useEffect(() => {
        if (!user) return

        const doSync = async () => {
            setStatus('syncing')
            setStatus('online')
            try {
                await Promise.all([
                    syncTeas(),
                    syncJournals(),
                    syncBrews(),
                    syncPresets(),
                    syncSettings(),
                    checkAccess(user.id),
                ])
            } catch (err) {
                console.error('❌ Sync error:', err)
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
    }, [user, syncTeas, syncJournals, syncBrews, syncPresets, checkAccess, syncSettings])

    if (!status) return null

    return (
        <div style={{
            textAlign: 'center',
            marginTop: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
        }}>
            <small>
                {status === 'offline' && '❌ Connection lost'}
                {status === 'online' && '🌐 Back online'}
            </small>
        </div>
    )
}

export default SyncOnReconnect