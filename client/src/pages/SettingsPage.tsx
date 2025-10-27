'use client'

function SettingsPage() {
    return (
        <>
            <section className="page-wrap settings-page">
                <header className="page-header">
                    <h1>Settings</h1>
                    <p className="subtitle">Edit your settings 🍵</p>
                </header>

                <div className="settings-content">
                    <section className="subscription">
                        <h2>Manage your subscription</h2>
                        <p>You have no subscription at the moment.</p>
                        <button className="btn btn-quick">Switch to <strong>PRO</strong> for $2 a month</button>
                        <details>
                            <summary>
                                See PRO benefits
                            </summary>
                            <p>- cloud sync across all devices</p>
                            <p>- recommendations from AI</p>
                            <p>- dark theme</p>
                        </details>
                    </section>

                    <section className="quick-actions">
                        <h2>Quick actions</h2>
                        <div className="quick-action-btns">
                            <button className="btn btn-dark">dark theme</button>
                            <button className="btn btn-danger">delete account</button>
                        </div>
                    </section>
                </div>
            </section>
        </>
    )
}

export default SettingsPage