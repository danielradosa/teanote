import { useAuthStore } from '../stores/useAuthStore'
import SubscribeMonthly from '../components/payment/SubscribeMonthly'
import SubscribeYearly from '../components/payment/SubscribeYearly'

export default function AccountPage() {
    const { user, trialDaysLeft, signOut } = useAuthStore()

    return (
        <section className="page-wrap account-page">
            <header className="page-header">
                <h1>Account</h1>
                <p className="subtitle">Manage your account here 🍵</p>
            </header>

            <section className="account-content">
                <section className="manage-account">
                    <h2>Your information</h2>
                    <p>Subscription status: <span className="sub-status">NOT ACTIVE</span></p>
                    <p>E-mail: <strong>{user?.email}</strong></p>
                    <button onClick={signOut} style={{ width: 'max-content' }} className="btn btn-danger">Log out</button>

                    <h2 style={{ marginTop: 10 }}>Subscribe now</h2>
                    <div className="subscription-wrap">
                        {trialDaysLeft !== null && <p>You have <strong>{trialDaysLeft}</strong> days of trial left.
                        <br />Finish your trial and subscribe now.</p>}
                        <SubscribeMonthly />
                        <SubscribeYearly />
                    </div>
                </section>
            </section>
        </section>
    )
}