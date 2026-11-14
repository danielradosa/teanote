import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import DesktopNavDummy from '@/components/layout/DesktopNavDummy'
import DesktopSidebarDummy from '@/components/layout/DesktopSidebarDummy'
import i18n from '@/lang'

export default function AppInitializer({ children }: { children: React.ReactNode }) {
    const initAuth = useAuthStore((s) => s.initAuth)
    const { settings } = useSettingsStore()
    const [ready, setReady] = useState(false)

    const applyTheme = (themeName: string | null | undefined) => {
        const theme = themeName?.toLowerCase() || 'default'
        const themeMap: Record<string, string> = {
            cozy: '/themes/cozy.css',
            night: '/themes/night.css',
            sakura: '/themes/sakura.css',
        }

        const key = Object.keys(themeMap).find(k => theme.includes(k))
        const themeFile = key ? themeMap[key] : '/themes/default.css'

        let link = document.getElementById('theme-css') as HTMLLinkElement | null
        if (link) {
            link.href = themeFile
        } else {
            link = document.createElement('link')
            link.rel = 'stylesheet'
            link.href = themeFile
            link.id = 'theme-css'
            document.head.appendChild(link)
        }
    }

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme')
        applyTheme(savedTheme)
    }, [])

    useEffect(() => {
        if (settings?.language) {
            i18n.changeLanguage(settings.language)
        }
    }, [settings?.language])

    useEffect(() => {
        if (settings?.theme) {
            applyTheme(settings.theme)
            localStorage.setItem('theme', settings.theme)
        }
    }, [settings?.theme])

    // Settings are not loaded here: SyncOnReconnect's first sync loads them once
    // auth is initialised and a user is signed in, without holding up first paint.
    useEffect(() => {
        const init = async () => {
            await initAuth()
            setReady(true)
        }
        init()
    }, [initAuth])

    if (!ready) {
        return (
            <>
                <DesktopNavDummy />
                <DesktopSidebarDummy />
            </>
        )
    }

    return <>{children}</>
}
