'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/useSettingsStore'

export default function ThemeManager() {
    const { settings } = useSettingsStore()

    useEffect(() => {
        if (!settings?.theme) return

        const themeFile = `/themes/${settings.theme.toLowerCase().replace('teanote ', '')}.css`

        const old = document.getElementById('theme-link')
        if (old) old.remove()

        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = themeFile
        link.id = 'theme-link'
        document.head.appendChild(link)

        return () => link.remove()
    }, [settings?.theme])

    return null
}