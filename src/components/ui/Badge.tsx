import type { ReactNode } from 'react'
import './badge.css'

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger'

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`badge badge--${tone} ${className ?? ''}`.trim()}>
      {icon}
      {children}
    </span>
  )
}
