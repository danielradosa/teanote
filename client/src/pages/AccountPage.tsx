import { useAuthStore } from '../stores/useAuthStore'

export default function AccountPage() {
    const { user, trialDaysLeft, signOut } = useAuthStore()

    return (
        <div>
            <h2>Account</h2>
            <p>Email: {user?.email}</p>
            {trialDaysLeft !== null && <p>Trial days left: {trialDaysLeft}</p>}
            <button onClick={signOut} className="btn btn-danger">Log out</button>
        </div>
    )
}