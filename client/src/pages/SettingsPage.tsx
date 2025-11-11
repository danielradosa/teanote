'use client'

import { useAuthStore } from '../stores/useAuthStore'

function SettingsPage() {
    const { isSubscribed } = useAuthStore()

    if (isSubscribed) {
        return (
            <section className="page-wrap settings-page">
                <header className="page-header">
                    <h1>Settings</h1>
                    <p className="subtitle">Edit your settings 🍵</p>
                </header>

                <div className="settings-content">
                    <section className="quick-actions">
                        <h2>Preferences</h2>
                        <p>These feauters are being worked on.</p>
                        <div className="quick-action-btns">
                            <button className="btn btn-dark disabled">choose a theme</button>
                            <button className='btn btn-dark disabled'>enable AI features</button>
                            <button className="btn btn-dark disabled">change language</button>
                        </div>
                    </section>
                </div>
            </section>
        )
    } else {
        return;
    }
}

export default SettingsPage