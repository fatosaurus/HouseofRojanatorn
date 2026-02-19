import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { getMeProfile, loginUser } from '../api/client'
import { clearPersistedSession, loadPersistedSession, savePersistedSession } from './session-storage'
import { SessionContext } from './session-context'

export function SessionProvider({ children }: { children: ReactNode }) {
  const initialSession = loadPersistedSession()
  const [email, setEmail] = useState(initialSession?.email ?? '')
  const [role, setRole] = useState(initialSession?.role ?? 'member')
  const [token, setToken] = useState(initialSession?.token ?? null)
  const [expiresAtUtc, setExpiresAtUtc] = useState(initialSession?.expiresAtUtc ?? null)

  const persist = useCallback((nextEmail: string, nextRole: 'member' | 'admin', nextToken: string | null, nextExpiresAtUtc: string | null) => {
    if (!nextEmail) {
      clearPersistedSession()
      return
    }

    savePersistedSession({
      email: nextEmail,
      role: nextRole,
      token: nextToken,
      expiresAtUtc: nextExpiresAtUtc
    })
  }, [])

  const signIn = useCallback(
    async (nextEmail: string, password: string) => {
      const normalizedEmail = nextEmail.trim().toLowerCase()
      const auth = await loginUser(normalizedEmail, password)

      setEmail(normalizedEmail)
      setRole(auth.role)
      setToken(auth.token)
      setExpiresAtUtc(auth.expiresAtUtc)
      persist(normalizedEmail, auth.role, auth.token, auth.expiresAtUtc)

      try {
        const profile = await getMeProfile()
        setRole(profile.role)
        persist(normalizedEmail, profile.role, auth.token, auth.expiresAtUtc)
      } catch {
        // Ignore profile read failures; auth token already established.
      }
    },
    [persist]
  )

  const signOut = useCallback(() => {
    setEmail('')
    setRole('member')
    setToken(null)
    setExpiresAtUtc(null)
    clearPersistedSession()
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated: email.length > 0 && token !== null,
      hasAccessToken: token !== null,
      email,
      role,
      expiresAtUtc,
      signIn,
      signOut
    }),
    [email, expiresAtUtc, role, signIn, signOut, token]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
