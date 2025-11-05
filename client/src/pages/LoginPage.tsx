import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { Link } from 'react-router-dom'

export default function LoginPage() {
    const { signIn, loading } = useAuthStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const handleLogin = async () => {
        console.log('[LoginPage] handleLogin clicked –', email)
        const error = await signIn(email, password)
        if (error) console.error('[LoginPage] login error', error)
        else console.log('[LoginPage] login successful')
    }

    if (loading) return null

    return (
        <section className="login">
            <div className='login-form'>
                <div className='logo-login'>🍵</div>
                <h2>Hey there, traveller.</h2>
                <label>
                    <span className="basic-label"><span className="req">* </span>E-mail:</span>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. joshie@site.com"
                        required
                    />
                </label>
                <label>
                    <span className="basic-label"><span className="req">* </span>Password:</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="**************"
                        required
                    />
                </label>
                <a href="#" className='forgot-pwd'>Forgot your password?</a>
                <button onClick={handleLogin} className='btn btn-quick'>
                    Log in to your account
                </button>
                <span className='new-account'>No account yet? <Link to={"/signup"}>Create one</Link>.</span>
            </div>
        </section>
    )
}