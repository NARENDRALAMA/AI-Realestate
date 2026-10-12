/**
 * The signed-in session: a bearer token from POST /api/auth/login|register, kept in
 * localStorage so a reload stays signed in. Any 401 from the API clears it and fires
 * SIGNED_OUT_EVENT so the app can return to the sign-in page.
 */

export interface User {
  id: number
  name: string
  email: string
  role: string
  created_at: string
}

const TOKEN_KEY = 'rem.auth.token'
const USER_KEY = 'rem.auth.user'
export const SIGNED_OUT_EVENT = 'rem:signed-out'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return read(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const raw = read(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function saveSession(token: string, user: User) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // Storage blocked (private mode): the session lasts until the tab closes.
  }
  memoryToken = token
}

export function clearSession() {
  memoryToken = null
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    sessionStorage.clear()
  } catch {
    // ignore
  }
}

// Fallback when localStorage is unavailable.
let memoryToken: string | null = null

export function authHeader(): Record<string, string> {
  const token = getToken() ?? memoryToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function signalSignedOut() {
  clearSession()
  window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
}
