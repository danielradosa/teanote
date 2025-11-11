import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { Link } from 'react-router-dom'
import Loader from '../components/Loader'

export default function LoginPage() {
    const { signIn } = useAuthStore()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleLogin = async () => {
        setError('')
        setSuccess('')
        setIsSubmitting(true)

        const err = await signIn(email, password)
        setIsSubmitting(false)

        if (err) {
            console.error('[LoginPage] login error', err)
            setError(err.message || 'Invalid e-mail or password')
        } else {
            console.log('[LoginPage] login successful')
            setSuccess('Welcome back! Redirecting...')
        }
    }

    return (
        <section className="login">
            <div className="login-form">
                <div className="logo-login">🍵</div>

                {isSubmitting && <Loader />}

                <h2>Hey there, traveller.</h2>

                {error && <div className="msg error">{error}</div>}
                {success && <div className="msg success">{success}</div>}

                <label>
                    <span className="basic-label">
                        <span className="req">* </span>E-mail:
                    </span>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. joshie@site.com"
                        required
                    />
                </label>

                <label>
                    <span className="basic-label">
                        <span className="req">* </span>Password:
                    </span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="**************"
                        required
                    />
                </label>

                <a href="#" className="forgot-pwd">
                    Forgot password?
                </a>

                <button
                    onClick={handleLogin}
                    className="btn btn-quick"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Logging in...' : <span>Log in &rarr;</span>}
                </button>

                <span className="new-account">
                    No account yet? <Link to="/signup">Create one</Link>.
                </span>
            </div>
        </section>
    )
}