/** The house-outline logomark (same drawing as the favicon). */
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="14" fill="var(--color-ink)" />
      <path
        d="M16 30 32 17l16 13v17a2 2 0 0 1-2 2H37V38H27v11h-9a2 2 0 0 1-2-2V30Z"
        fill="none"
        stroke="var(--color-accent-on-ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
