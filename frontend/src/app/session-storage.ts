import type { AppRole } from '../types/role'

const STORAGE_KEY = 'app.session'

interface PersistedSession {
  email: string
  role: AppRole
  token: string | null
  expiresAtUtc: string | null
}

export function loadPersistedSession(): PersistedSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed.email) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function savePersistedSession(value: PersistedSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function clearPersistedSession(): void {
  window.localStorage.removeItem(STORAGE_KEY)
}

export function getAccessToken(): string | null {
  return loadPersistedSession()?.token ?? null
}
