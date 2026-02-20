import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUser } from '../api/client'
import { useSession } from '../app/useSession'
import { HttpError } from '../lib/http'

type AuthMode = 'login' | 'create'

function toUiError(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return 'Invalid credentials. Please check your email and password.'
    }

    if (error.status === 409) {
      return 'User already exists. Switch to Sign In.'
    }

    if (error.status === 400) {
      return 'Invalid request. Ensure email is valid and password has at least 8 characters.'
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
  const [mode, setMode] = useState<AuthMode>('login')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { signIn } = useSession()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim()) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (mode === 'create') {
        await createUser(email.trim().toLowerCase(), password)
      }

      await signIn(email, password)
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
          <li>Secure role-backed login via Cosmos + JWT</li>
        </ul>
      </div>

      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Access Portal</h2>
        <p>Sign in to continue or create a new internal test user.</p>

        <div className="auth-mode-row">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Sign In
          </button>
          <button type="button" className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>
            Create User
          </button>
        </div>

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
          placeholder="minimum 8 characters"
          minLength={8}
          required
        />

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" disabled={submitting} className="primary-btn">
          {submitting ? 'Please wait...' : mode === 'create' ? 'Create User and Sign In' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
