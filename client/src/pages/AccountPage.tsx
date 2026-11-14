import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { t } from 'i18next'

export default function AccountPage() {
    const { user, signOut } = useAuthStore()

    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <section className="page-wrap account-page">
            <header className="page-header">
                <h1>{t('account_title')}</h1>
                <p className="subtitle">{t('account_subtitle')} 🍵</p>
            </header>

            <section className="account-content">
                <section className="manage-account">
                    <h2>{t('account_info')}</h2>
                    <p>{t('account_email')}: <strong>{user?.email}</strong></p>
                    {user?.id && <p>{t('account_id')}: <strong>{user.id}</strong></p>}

                    <button onClick={handleLogout} className="btn btn-danger" style={{ width: 'max-content', marginTop: 10 }}>
                        &larr; {t('account_logout')}
                    </button>
                </section>
            </section>
        </section>
    )
}
