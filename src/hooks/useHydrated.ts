import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/**
 * `false` on the server and during hydration, `true` afterwards (and immediately for
 * client-only renders). Use it to skip entrance animations in prerendered HTML so the
 * page is fully visible before JavaScript runs.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
}
