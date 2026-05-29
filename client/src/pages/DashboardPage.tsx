import { t } from 'i18next'
import TeaTypePieChart from '@/components/PieChart'
import AiInsights from '@/components/dashboard/AiInsights'
import { useTeasStore } from '@/stores/useTeasStore'

function DashboardPage() {
    const savedTeas = useTeasStore().visibleTeas()

    return (
        <section className="page-wrap dashboard-page">
            <header className="page-header">
                <h1>{t('dashboard_title')}</h1>
                <p className="subtitle">{t('dashboard_subtitle')} 🍵</p>
            </header>

            <div className="dashboard-content">
                <section className="stats">
                    <h2>{t('dash_teas_overview')}</h2>
                    <TeaTypePieChart teas={savedTeas} />
                </section>

                <section className="stats">
                    <AiInsights slot="profile" />
                </section>

                <section className="stats">
                    <AiInsights slot="patterns" />
                </section>
            </div>
        </section>
    )
}

export default DashboardPage
