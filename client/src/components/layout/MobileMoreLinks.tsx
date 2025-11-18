'use client'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from 'i18next'

interface HiddenLink {
    to: string
    label: string
}

const MobileMoreLinks = () => {
    const [show, setShow] = useState(false)

    const hiddenLinks: HiddenLink[] = [
        { to: '/', label: '🏠 ' + t('sidebar_link_home') },
        { to: '/account', label: '👨🏻‍🔧 ' + t('sidebar_link_account') },
        { to: '/settings', label: '⚙️ ' + t('sidebar_link_settings') },
    ]

    return (
        <div className="mobile-more-links hide-desktop">
            <button className="btn btn-sidebar" onClick={() => setShow(prev => !prev)}>
                {show ? `⬇️ ${t('sidebar_link_less')}` : `⬆️ ${t('sidebar_link_more')}`}
            </button>
            {show && (
                <div className="more-links">
                    {hiddenLinks.map(link => (
                        <Link key={link.to} to={link.to} className="btn btn-sidebar">
                            {link.label}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default MobileMoreLinks