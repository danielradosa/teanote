/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useSettingsStore } from '../stores/useSettingsStore'

function SettingsPage() {
    const { user, isSubscribed } = useAuthStore()
    const { settings, loading, toggleAI, setTheme, setLanguage, loadSettings } = useSettingsStore()

    useEffect(() => {
        if (user) loadSettings()
    }, [user, loadSettings])

    if (!isSubscribed) return null

    return (
        <section className="page-wrap settings-page">
            <header className="page-header">
                <h1>Settings</h1>
                <p className="subtitle">Edit your settings 🍵</p>
            </header>

            <div className="settings-content">
                {loading ? (
                    <p>Loading…</p>
                ) : settings ? (
                    <section className="quick-actions">
                        <h2>Preferences</h2>
                        <div className="quick-action-btns">
                            <select value={settings.theme} onChange={e => setTheme(e.target.value as any)}>
                                <option>Teanote Default</option>
                                <option>Teanote Cozy</option>
                                <option>Teanote Night</option>
                            </select>

                            <button onClick={toggleAI}>
                                AI: {settings.ai_enabled ? 'On' : 'Off'}
                            </button>

                            <select value={settings.language} onChange={e => setLanguage(e.target.value as any)}>
                                <option value="en">English</option>
                                <option value="sk">Slovak</option>
                                <option value="jp">Japanese</option>
                                <option value="chinese">Chinese</option>
                                <option value="korean">Korean</option>
                            </select>
                        </div>
                    </section>
                ) : (
                    <p>Error loading settings</p>
                )}
            </div>
        </section>
    )
}

export default SettingsPage