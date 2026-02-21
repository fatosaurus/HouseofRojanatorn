import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptInvite, getInviteDetails } from '../api/client'
import { useSession } from '../app/useSession'

export function AcceptInvitePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signIn } = useSession()

  const token = useMemo(() => params.get('token')?.trim() ?? '', [params])

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invite token is missing.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    void getInviteDetails(token)
      .then(details => {
        setEmail(details.email)
        setRole(details.role)
      })
      .catch(() => {
        setError('Invite link is invalid or expired.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      setError('Invite token is missing.')
      return
    }

    if (password.length < 8) {
      setError('Password must contain at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await acceptInvite(token, password)
      await signIn(email, password)
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Unable to complete invite setup.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <h1>Set Up Your Account</h1>
        <p>Use your invite link to create a password and access the operations workspace.</p>
      </div>

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Accept Invite</h2>
        {loading ? (
          <p>Checking invite...</p>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : (
          <>
            <p>
              <strong>{email}</strong>
              {' '}
              ({role})
            </p>
            <label htmlFor="password-input">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={8}
              required
            />

            <label htmlFor="confirm-password-input">Confirm Password</label>
            <input
              id="confirm-password-input"
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />

            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Saving...' : 'Set Password and Sign In'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
