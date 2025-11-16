'use client'

import { t } from 'i18next';

function DashboardPage() {

    return (
        <section className="page-wrap dashboard-page">
            <header className="page-header">
                <h1>{t('dashboard_title')}</h1>
                <p className="subtitle">{t('dashboard_subtitle')} 🍵</p>
            </header>

            <div className="dashboard-content">
                <section className="dashboard-feed">
                    <h2>Recent journal entries</h2>
                    <p>Feed</p>
                </section>

                <section className="dashboard-suggestions">
                    <h2>Seasonal suggestions for 2026</h2>
                    <p>Winter - </p>
                    <p>Fall - </p>
                    <p>Spring - </p>
                    <p>Summer - </p>
                </section>

                <section className="recent-sessions">
                    <h2>Tea of the day</h2>
                    <p>Oh this one's good!</p>
                </section>

                <section className="stats" style={{ flex: '100%' }}>
                    <h2>Stats</h2>
                    <p>Most brewed teas - pie chart?</p>
                </section>
            </div>
        </section>
    )
}

export default DashboardPage