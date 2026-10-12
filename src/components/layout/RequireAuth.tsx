import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/** Sends signed-out visitors to /login, then back to where they were going. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  }
  return <>{children}</>
}
