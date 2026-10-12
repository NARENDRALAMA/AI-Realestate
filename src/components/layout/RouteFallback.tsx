import { Loader2 } from 'lucide-react'

/** Shown for the split second while a route's code chunk loads. */
export function RouteFallback() {
  return (
    <div className="route-fallback" role="status">
      <Loader2 className="spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
