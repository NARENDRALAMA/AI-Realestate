import './skeleton.css'

/** Decorative loading placeholder. Wrap groups in an element with aria-busy and a text label. */
export function Skeleton({
  variant = 'line',
  width,
  className,
}: {
  variant?: 'line' | 'title' | 'block' | 'stat'
  /** Any CSS width, e.g. "60%". */
  width?: string
  className?: string
}) {
  return (
    <span
      className={`skeleton skeleton--${variant} ${className ?? ''}`.trim()}
      style={width ? { width } : undefined}
      aria-hidden
    />
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className="skeleton-text" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : undefined} />
      ))}
    </span>
  )
}
