import { getAccessToken } from '../app/session-storage'

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

interface FetchJsonInit extends RequestInit {
  skipAuth?: boolean
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: FetchJsonInit): Promise<T> {
  const token = init?.skipAuth ? null : getAccessToken()
  const { skipAuth: _skipAuth, ...requestInit } = init ?? {}
  void _skipAuth

  const response = await fetch(input, {
    ...requestInit,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(requestInit.headers || {})
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new HttpError(response.status, text || response.statusText)
  }

  return (await response.json()) as T
}
