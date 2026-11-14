import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import i18n, { t } from 'i18next'

function DesktopNav() {
    const { signOut } = useAuthStore()
    const navigate = useNavigate()

    const [, setLanguage] = useState(i18n.language)

    useEffect(() => {
        const handleLanguageChange = (lng: string) => {
            setLanguage(lng)
        }
        i18n.on('languageChanged', handleLanguageChange)
        return () => {
            i18n.off('languageChanged', handleLanguageChange)
        }
    }, [])

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    return (
        <header className="main-header">
            <div className="logo">
                <Link to="/">🍵 {t('app_name')}</Link>
            </div>
            <nav>
                <Link to="/brews">
                    <button className="btn btn-action">⏳ {t('nav_link_start_brew')}</button>
                </Link>
                <Link to="/journal">
                    <button className="btn btn-action">📔 {t('nav_link_journal')}</button>
                </Link>
                <button className="btn btn-action logout-btn" onClick={handleLogout}>
                    &larr; {t('nav_logout_btn')}
                </button>
            </nav>
        </header>
    )
}

export default DesktopNav
