import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login, logout, register } from '../lib/api'
import { clearSession, getStoredUser, saveSession, SIGNED_OUT_EVENT, type User } from '../lib/auth'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (typeof window === 'undefined' ? null : getStoredUser()))

  // Any 401 from the API (expired or revoked session) signs the user out everywhere.
  useEffect(() => {
    const onSignedOut = () => setUser(null)
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut)
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user } = await login(email, password)
    saveSession(token, user)
    setUser(user)
  }, [])

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { token, user } = await register(name, email, password)
    saveSession(token, user)
    setUser(user)
  }, [])

  const signOut = useCallback(async () => {
    await logout()
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, signIn, signUp, signOut }), [user, signIn, signUp, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
