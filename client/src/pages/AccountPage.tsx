import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import SubscribeMonthly from '../components/payment/SubscribeMonthly'
import SubscribeYearly from '../components/payment/SubscribeYearly'

export default function AccountPage() {
    const { user, trialDaysLeft, signOut, isSubscribed, subscriptionEnd, checkAccess } = useAuthStore()
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    useEffect(() => {
        const success = searchParams.get('success')
        const cancelled = searchParams.get('cancelled')

        if (user && (success || cancelled)) {
            checkAccess(user.id)
            setSearchParams({})
        }
    }, [searchParams, user])

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    const now = new Date()
    const subEndDate = subscriptionEnd ? new Date(subscriptionEnd) : null
    const hasActiveSubscription = isSubscribed && subEndDate && subEndDate > now

    return (
        <section className="page-wrap account-page">
            <header className="page-header">
                <h1>Account</h1>
                <p className="subtitle">Manage your account here 🍵</p>
            </header>

            <section className="account-content">
                <section className="manage-account">
                    <h2>Your information</h2>
                    <p>
                        Subscription status:{' '}
                        <span className={`sub-status ${hasActiveSubscription ? 'active' : 'inactive'}`}>
                            {hasActiveSubscription ? 'ACTIVE ✅' : 'INACTIVE ❌'}
                        </span>
                    </p>
                    <p>E-mail: <strong>{user?.email}</strong></p>
                    <button
                        onClick={handleLogout}
                        style={{ width: 'max-content' }}
                        className="btn btn-danger"
                    >
                        Log out
                    </button>

                    {searchParams.get('success') && (
                        <div className="msg success">🎉 Subscription active!</div>
                    )}
                    {searchParams.get('cancelled') && (
                        <div className="msg error">⚠️ Payment cancelled</div>
                    )}

                    {/* Show subscription options if not active */}
                    {!hasActiveSubscription && (
                        <>
                            <h2 style={{ marginTop: 10 }}>Subscribe now</h2>
                            <div className="subscription-wrap">
                                {trialDaysLeft !== null && trialDaysLeft > 0 && (
                                    <p>
                                        You have <strong>{trialDaysLeft}</strong> days of trial left.
                                        <br />Finish your trial and subscribe now.
                                    </p>
                                )}
                                <SubscribeMonthly />
                                <SubscribeYearly />
                            </div>

                            {(!isSubscribed && (!trialDaysLeft || trialDaysLeft <= 0)) && (
                                <p className="msg error" style={{ marginTop: 16 }}>
                                    You must have an active subscription or trial to access your brews and journal.
                                </p>
                            )}
                        </>
                    )}
                </section>
            </section>
        </section>
    )
}