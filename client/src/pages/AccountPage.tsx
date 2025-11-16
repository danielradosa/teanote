'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import SubscribeMonthly from '../components/payment/SubscribeMonthly'
import SubscribeYearly from '../components/payment/SubscribeYearly'
import { t } from 'i18next';

export default function AccountPage() {
    const { user, trialDaysLeft, signOut, isSubscribed, subscriptionEnd, checkAccess } = useAuthStore()

    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const [now] = useState(new Date())

    useEffect(() => {
        const success = searchParams.get('success')
        const cancelled = searchParams.get('cancelled')

        if (user && (success || cancelled)) {
            checkAccess(user.id)
            setSearchParams({})
        }
    }, [checkAccess, searchParams, setSearchParams, user])

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const subEndDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const hasActiveSubscription = isSubscribed && subEndDate && subEndDate > now

    return (
        <section className="page-wrap account-page">
            <header className="page-header">
                <h1>{t('account_title')}</h1>
                <p className="subtitle">{t('account_subtitle')} 🍵</p>
            </header>

            <section className="account-content">
                <section className="manage-account">
                    <h2>{t('account_info')}</h2>
                    <p>
                        {t('account_sub_status')}:{' '}
                        <span className={`sub-status ${hasActiveSubscription ? 'active' : 'inactive'}`}>
                            {hasActiveSubscription ? `${t('account_sub_status_active')} ✅` : `${t('account_sub_status_active')} ❌`}
                        </span>
                    </p>
                    <p>{t('account_email')}: <strong>{user?.email}</strong></p>
                    {user?.id && <p>{t('account_id')}: <strong>{user.id}</strong></p>}

                    <button onClick={handleLogout} className="btn btn-danger" style={{ width: 'max-content', marginTop: 10 }}>
                        &larr; {t('account_logout')}
                    </button>

                    {searchParams.get('success') && (
                        <div className="msg success">🎉 {t('account_purchased')}</div>
                    )}
                    {searchParams.get('cancelled') && (
                        <div className="msg error">⚠️ {t('account_cancelled')}</div>
                    )}

                    {!hasActiveSubscription && (
                        <>
                            <h2 style={{ marginTop: 10 }}>{t('account_sub_btn')}</h2>
                            <div className="subscription-wrap">
                                {trialDaysLeft !== null && trialDaysLeft > 0 && (
                                    <p>{t('account_you_have')} <strong>{trialDaysLeft}</strong> {t('account_trial_left')}.</p>
                                )}
                                <SubscribeMonthly />
                                <SubscribeYearly />
                            </div>

                            {(!isSubscribed && (!trialDaysLeft || trialDaysLeft <= 0)) && (
                                <p className="msg error" style={{ marginTop: 16 }}>
                                    {t('account_not_subbed')}.
                                </p>
                            )}
                        </>
                    )}
                </section>
            </section>
        </section>
    )
}