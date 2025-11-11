import { useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { Link, Navigate } from 'react-router-dom'
import Loader from '../components/Loader'

export default function SignupPage() {
  const { signUp, user } = useAuthStore()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSignup = async () => {
    setError('')
    setSuccess('')

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!agreeTerms || !agreePrivacy) {
      setError('You must agree to the Terms of Use and Privacy Policy')
      return
    }

    setIsSubmitting(true)
    const err = await signUp(email, password)
    setIsSubmitting(false)

    if (err) setError(err.message || 'Something went wrong.')
    else setSuccess('Check your email for account verification.')
  }

  return (
    <section className="signup">
      <div className="signup-form">
        <div className="logo-signup">🍵</div>

        {isSubmitting && (
          <Loader />
        )}

        <h2>Sign up for Teanote</h2>

        {error && <div className="msg error">{error}</div>}
        {success && <div className="msg success">{success}</div>}

        <div className="name-row">
          <label>
            <span className="basic-label"><span className="req">* </span>First Name:</span>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. John" required />
          </label>
          <label>
            <span className="basic-label"><span className="req">* </span>Last Name:</span>
            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Doe" required />
          </label>
        </div>

        <label>
          <span className="basic-label"><span className="req">*</span> E-mail:</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. john@site.com"
            required
          />
        </label>

        <label>
          <span className="basic-label"><span className="req">*</span> Password:</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="***********"
            required
          />
        </label>

        <label>
          <span className="basic-label"><span className="req">*</span> Confirm Password:</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="***********"
            required
          />
        </label>

        <label className="checkbox-label" style={{ marginTop: '16px' }}>
          <input
            type="checkbox"
            checked={agreeTerms}
            required
            onChange={(e) => setAgreeTerms(e.target.checked)}
          />
          <span>I agree to the <Link to="https://docs.teanote.xyz/terms" target="_blank">Terms of Use</Link></span>
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={agreePrivacy}
            required
            onChange={(e) => setAgreePrivacy(e.target.checked)}
          />
          <span>I agree to the <Link to="https://docs.teanote.xyz/privacy" target="_blank">Privacy Policy</Link></span>
        </label>

        <button
          onClick={handleSignup}
          className="btn btn-quick signup-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating account...' : <span>Create your account &rarr;</span>}
        </button>

        <span className="existing-account">
          Already have an account? <Link to="/login">Log in</Link>.
        </span>
      </div>
    </section>
  )
}