import type { AppRole } from '../types/role'

export interface AuthResponse {
  token: string
  expiresAtUtc: string
  role: AppRole
}

export interface MeProfile {
  userId: string
  email: string
  role: AppRole
}
