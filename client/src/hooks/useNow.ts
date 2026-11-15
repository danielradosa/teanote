import { useEffect, useState } from 'react'

// The current time, for displays that are computed from the clock. It is
// refreshed every `intervalMs` while `ticking`, and at once on mount and
// whenever the page's visibility changes: a hidden tab or a locked phone runs
// few or no timers, so the interval alone would show a stale time on return.
export function useNow(ticking: boolean, intervalMs = 250): number {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const refresh = () => setNow(Date.now())
        refresh()
        document.addEventListener('visibilitychange', refresh)
        const interval = ticking ? setInterval(refresh, intervalMs) : undefined
        return () => {
            document.removeEventListener('visibilitychange', refresh)
            clearInterval(interval)
        }
    }, [ticking, intervalMs])

    return now
}
