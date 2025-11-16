/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { t } from 'i18next'

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
                <h1>{t('settings_title')}</h1>
                <p className="subtitle">{t('settings_subtitle')} 🍵</p>
            </header>

            <div className="settings-content">
                <section className="quick-actions">
                    <h2>{t('settings_preferences')}</h2>
                    <div className="quick-action-btns settings-form">
                        <label>
                            <span className="basic-label">{t('settings_ai_label')}:</span>
                            <button onClick={toggleAI} className='btn btn-dark' style={{ width: '100%' }}>
                                {settings?.ai_enabled ? `${t('settings_ai_on')} ✨` : `${t('settings_ai_off')} 🙅🏻‍♂️`}
                            </button>
                        </label>

                        <label>
                            <span className="basic-label"><span className="req">* </span>{t('settings_theme_label')}:</span>
                            <div className="select-wrap">
                                <select
                                    value={settings?.theme || 'Teanote Default'}
                                    onChange={e => setTheme(e.target.value as any)}
                                >
                                    <option>Teanote Default</option>
                                    <option>Teanote Cozy</option>
                                    <option>Teanote Night</option>
                                    <option>Teanote Sakura</option>
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>

                        <label>
                            <span className="basic-label"><span className="req">* </span>{t('settings_lang_label')}:</span>
                            <div className="select-wrap">
                                <select
                                    value={settings?.language || 'en'}
                                    onChange={e => setLanguage(e.target.value as any)}
                                >
                                    <option value="en">English</option>
                                    <option value="sk">Slovenčina</option>
                                    <option value="ja">日本語</option>
                                    <option value="zh">中文</option>
                                    <option value="ko">한국어</option>
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