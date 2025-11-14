/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useSettingsStore } from '../stores/useSettingsStore'

function SettingsPage() {
    const { user, isSubscribed } = useAuthStore()
    const { settings, toggleAI, setTheme, setLanguage, loadSettings } = useSettingsStore()

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
                <section className="quick-actions">
                    <h2>Preferences</h2>
                    <div className="quick-action-btns settings-form">
                        <label>
                            <span className="basic-label">AI features (optional):</span>
                            <button onClick={toggleAI} className='btn btn-dark' style={{ width: '100%'}}>
                                {settings?.ai_enabled ? 'On ✨' : 'Off 🙅🏻‍♂️'}
                            </button>
                        </label>
                        
                        <label>
                            <span className="basic-label"><span className="req">* </span>Select theme:</span>
                            <div className="select-wrap">
                                <select value={settings?.theme} onChange={e => setTheme(e.target.value as any)}>
                                    <option>Teanote Default</option>
                                    <option>Teanote Cozy</option>
                                    <option>Teanote Night</option>
                                    <option>Teanote Sakura</option>
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>

                        <label>
                            <span className="basic-label"><span className="req">* </span>Select language:</span>
                            <div className="select-wrap">
                                <select value={settings?.language} onChange={e => setLanguage(e.target.value as any)}>
                                    <option value="en">English</option>
                                    <option value="sk">Slovak</option>
                                    <option value="jp">Japanese</option>
                                    <option value="chinese">Chinese</option>
                                    <option value="korean">Korean</option>
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>
                    </div>
                </section>
            </div>
        </section>
    )
}

export default SettingsPage