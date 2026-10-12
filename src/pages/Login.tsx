import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { BrandMark } from '../components/BrandMark'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Field'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/api'
import './login.css'

type Mode = 'signin' | 'signup'

/** Only same-app paths are allowed as a return target. */
const safeNext = (next: string | null) => (next && next.startsWith('/app') ? next : '/app')

export function Login() {
  const { user, signIn, signUp } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = `${mode === 'signin' ? 'Sign in' : 'Create account'} · REM Content Studio`
  }, [mode])

  if (user) return <Navigate to={safeNext(params.get('next'))} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setBusy(true)
    try {
      if (mode === 'signin') await signIn(email, password)
      else await signUp(name, email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setFieldErrors({})
  }

  return (
    <main className="login">
      <Link to="/" className="login__brand">
        <BrandMark />
        <span>REM Content Studio</span>
      </Link>
      <Card as="section" padding="lg" className="login__card">
        <h1 className="login__title">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h1>
        <p className="login__lead">
          {mode === 'signin'
            ? 'Your content library is private to your account.'
            : 'Accounts keep each agent’s properties and content separate.'}
        </p>
        {error ? (
          <Alert tone="danger" className="login__alert">
            {error}
          </Alert>
        ) : null}
        <form className="stack" onSubmit={submit} noValidate>
          {mode === 'signup' ? (
            <Input
              label="Your name"
              autoComplete="name"
              required
              value={name}
              error={fieldErrors.name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : null}
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            error={fieldErrors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
            required
            value={password}
            error={fieldErrors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="login__switch">
          {mode === 'signin' ? (
            <>
              New here?{' '}
              <button type="button" className="login__link" onClick={() => switchMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="login__link" onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </Card>
    </main>
  )
}
