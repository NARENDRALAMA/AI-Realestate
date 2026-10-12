import { useCallback, useEffect, useState } from 'react'

interface AsyncState<T> {
  status: 'loading' | 'success' | 'error'
  data: T | null
  error: string | null
}

/**
 * Loads data on mount and on `reload()`. Keeps the previous data while reloading so the
 * page doesn't flash empty. `fn` must be stable (e.g. a module-level API function).
 */
export function useAsync<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fn().then(
      (data) => {
        if (active) setState({ status: 'success', data, error: null })
      },
      (err: unknown) => {
        if (active) {
          setState((s) => ({
            ...s,
            status: 'error',
            error: err instanceof Error ? err.message : 'Something went wrong',
          }))
        }
      },
    )
    return () => {
      active = false
    }
  }, [fn, attempt])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }))
    setAttempt((a) => a + 1)
  }, [])

  const setData = useCallback((update: (prev: T | null) => T | null) => {
    setState((s) => ({ ...s, data: update(s.data) }))
  }, [])

  return { ...state, reload, setData }
}
