import { createContext } from 'react'
import type { AppRole } from '../types/role'

export interface SessionContextValue {
  isAuthenticated: boolean
  hasAccessToken: boolean
  email: string
  role: AppRole
  expiresAtUtc: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

export const SessionContext = createContext<SessionContextValue | null>(null)
