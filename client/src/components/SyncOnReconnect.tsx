import { useEffect, useState } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useAuthStore } from '../stores/useAuthStore'

function SyncOnReconnect() {
    const { syncTeas } = useTeasStore()
    const { syncJournals } = useJournalsStore()
    const { user, checkAccess } = useAuthStore()
    const [status, setStatus] = useState<'offline' | 'syncing' | 'online' | null>(null)

    useEffect(() => {
        async function handleOnline() {
            setStatus('syncing')

            if (user) {
                try {
                    await syncTeas()
                    await syncJournals()

                    await checkAccess(user.id)
                } catch (err) {
                    console.error('❌ Sync error on reconnect:', err)
                }
            }

            setStatus('online')
            setTimeout(() => setStatus(null), 2000)
        }

        function handleOffline() {
            setStatus('offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        if (!navigator.onLine) handleOffline()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [user, syncTeas, syncJournals, checkAccess])

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
                {status === 'syncing' && '🌐 Back online'}
            </small>
        </div>
    )
}

export default SyncOnReconnect