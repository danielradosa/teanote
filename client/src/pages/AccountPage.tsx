import { useAuthStore } from '../stores/useAuthStore'

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
                    <h2>Your information:</h2>
                    <p>{user?.email}</p>
                    {trialDaysLeft !== null && <p>Trial days left: {trialDaysLeft}</p>}
                    <button onClick={signOut} className="btn btn-danger">Log out</button>
                </section>
            </section>
        </section>
    )
}