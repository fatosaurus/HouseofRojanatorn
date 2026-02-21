import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSession } from '../app/useSession'
import { HttpError } from '../lib/http'

function toUiError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return 'Invalid credentials. Please check your email and password.'
    }

    if (error.status === 400) {
      return 'Invalid request. Ensure email and password are both provided.'
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Authentication failed. Please try again.'
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { signIn } = useSession()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitting(true)
    setError(null)

    try {
      await signIn(email.trim().toLowerCase(), password)
      navigate('/dashboard')
    } catch (caughtError) {
      setError(toUiError(caughtError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-intro">
        <h1>House of Rojanatorn</h1>
        <p>Customer Journey and Gemstone Operations Workspace</p>
        <ul>
          <li>Real 2026 workbook stock mapped into Azure SQL</li>
          <li>Inventory and usage traceability by product code</li>
          <li>Role-based access with invite and password setup flow</li>
        </ul>
      </div>

      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Sign In</h2>
        <p>Use your invited account credentials to access the platform.</p>

        <label htmlFor="email-input">
          Email
        </label>
        <input
          id="email-input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <label htmlFor="password-input">
          Password
        </label>
        <input
          id="password-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="your password"
          minLength={8}
          required
        />

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" disabled={submitting} className="primary-btn">
          {submitting ? 'Please wait...' : 'Sign In'}
        </button>

        <p>
          Need to set your password from an invite?
          {' '}
          <Link to="/accept-invite">Open invite setup</Link>
        </p>
      </form>
    </div>
  )
}
