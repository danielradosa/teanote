import { useEffect, useState } from 'react'
import { useAuthStore } from './stores/useAuthStore'
import DesktopNavDummy from './components/layout/DesktopNavDummy'
import DesktopSidebarDummy from './components/layout/DesktopSidebarDummy'

export default function AppInitializer({ children }: { children: React.ReactNode }) {
    const initAuth = useAuthStore((s) => s.initAuth)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        initAuth().finally(() => setReady(true))
    }, [initAuth])

    if (!ready) return (
        <>
            <DesktopNavDummy />
            <DesktopSidebarDummy />
        </>
    )

    return <>{children}</>
}