import { useEffect } from 'react'

// Keeps the screen on while `active` and the page is visible, where the browser
// supports a screen wake lock. The browser drops the lock whenever the page is
// hidden, so it is asked for again each time the page becomes visible. It is
// released when `active` turns false or the component unmounts. Every failure
// is ignored: the timer works the same without the lock.
export function useWakeLock(active: boolean): void {
    useEffect(() => {
        if (!active || !('wakeLock' in navigator)) return

        let lock: WakeLockSentinel | null = null
        let requesting = false
        let stopped = false

        const release = (sentinel: WakeLockSentinel) => {
            sentinel.release().catch(() => {})
        }

        const acquire = async () => {
            if (stopped || requesting || document.visibilityState !== 'visible') return
            if (lock && !lock.released) return
            requesting = true
            try {
                const sentinel = await navigator.wakeLock.request('screen')
                if (stopped) release(sentinel)
                else lock = sentinel
            } catch {
                // Refused or unavailable right now.
            } finally {
                requesting = false
            }
        }

        const onVisibilityChange = () => {
            void acquire()
        }

        void acquire()
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => {
            stopped = true
            document.removeEventListener('visibilitychange', onVisibilityChange)
            if (lock && !lock.released) release(lock)
            lock = null
        }
    }, [active])
}
