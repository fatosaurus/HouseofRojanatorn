import { env } from '../lib/env'
import { fetchJson } from '../lib/http'
import type { AppRole } from '../types/role'
import type { AuthResponse, MeProfile } from './types'

type UnknownRecord = Record<string, unknown>

function pick<T>(record: UnknownRecord, camel: string, pascal: string): T | undefined {
  if (camel in record) {
    return record[camel] as T
  }
  if (pascal in record) {
    return record[pascal] as T
  }
  return undefined
}

function normalizeRole(value: unknown): AppRole {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return normalized === 'admin' ? 'admin' : 'member'
}

function mapAuthResponse(record: UnknownRecord): AuthResponse {
  const token = String(pick<string>(record, 'token', 'Token') ?? '')
  const expiresAtUtc = String(pick<string>(record, 'expiresAtUtc', 'ExpiresAtUtc') ?? '')
  const role = normalizeRole(pick<string>(record, 'role', 'Role'))

  if (!token || !expiresAtUtc) {
    throw new Error('Invalid auth response.')
  }

  return { token, expiresAtUtc, role }
}

function mapMeResponse(record: UnknownRecord): MeProfile {
  return {
    userId: String(pick<string>(record, 'userId', 'UserId') ?? ''),
    email: String(pick<string>(record, 'email', 'Email') ?? ''),
    role: normalizeRole(pick<string>(record, 'role', 'Role'))
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true
  })
  return mapAuthResponse(response)
}

export async function createUser(email: string, password: string, role: AppRole = 'member'): Promise<AuthResponse> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, password, role }),
    skipAuth: true
  })
  return mapAuthResponse(response)
}

export async function getMeProfile(): Promise<MeProfile> {
  const response = await fetchJson<UnknownRecord>(`${env.apiBaseUrl}/me/profile`)
  return mapMeResponse(response)
}
