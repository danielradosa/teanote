import { useEffect, useState } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useAuthStore } from '../stores/useAuthStore'

function SyncOnReconnect() {
    const { syncTeas } = useTeasStore()
    const { syncJournals } = useJournalsStore()
    const { syncBrews, syncPresets } = useBrewsStore()
    const { user, checkAccess } = useAuthStore()
    const [status, setStatus] = useState<'offline' | 'syncing' | 'online' | null>(null)

    useEffect(() => {
        if (!user) return

        const initialSync = async () => {
            setStatus('syncing')
            try {
                await syncTeas()
                await syncJournals()
                await syncBrews()
                await syncPresets()
                await checkAccess(user.id)
                setStatus('online')
            } catch (err) {
                console.error('❌ Initial sync error:', err)
                setStatus('offline')
            } finally {
                setTimeout(() => setStatus(null), 2000)
            }
        }

        initialSync()

        async function handleOnline() {
            setStatus('syncing')
            try {
                if (!user) return
                const { id } = user
                await syncTeas()
                await syncJournals()
                await syncBrews()
                await syncPresets()
                await checkAccess(id)
                setStatus('online')
            } catch (err) {
                console.error('❌ Sync error on reconnect:', err)
                setStatus('offline')
            } finally {
                setTimeout(() => setStatus(null), 2000)
            }
        }

        function handleOffline() {
            setStatus('offline')
        }

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        const interval = setInterval(() => {
            if (navigator.onLine) handleOnline()
        }, 5 * 60 * 1000)

        if (!navigator.onLine) handleOffline()

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            clearInterval(interval)
        }
    }, [user, syncTeas, syncJournals, syncBrews, syncPresets, checkAccess])

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