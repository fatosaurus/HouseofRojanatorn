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
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <form
        style={{ width: '100%', maxWidth: 420, background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 10px 30px rgba(2, 6, 23, 0.08)' }}
        onSubmit={onSubmit}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>House of Rojanatorn</h1>
        <p style={{ marginTop: 8, color: '#475569' }}>Starter authentication UI</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" onClick={() => setMode('login')} style={{ padding: '8px 12px' }}>
            Sign In
          </button>
          <button type="button" onClick={() => setMode('create')} style={{ padding: '8px 12px' }}>
            Create User
          </button>
        </div>

        <label style={{ display: 'block', marginTop: 12 }} htmlFor="email-input">
          Email
        </label>
        <input
          id="email-input"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <label style={{ display: 'block', marginTop: 12 }} htmlFor="password-input">
          Password
        </label>
        <input
          id="password-input"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="minimum 8 characters"
          minLength={8}
          required
        />

        {error ? <p style={{ marginTop: 12, color: '#b91c1c' }}>{error}</p> : null}

        <button type="submit" disabled={submitting} style={{ marginTop: 16, width: '100%', padding: '10px 12px', borderRadius: 8 }}>
          {submitting ? 'Please wait...' : mode === 'create' ? 'Create User and Sign In' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
