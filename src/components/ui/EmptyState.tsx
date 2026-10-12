import type { ReactNode } from 'react'
import './empty-state.css'

export function EmptyState({
  icon,
  title,
  description,
  actions,
  tone = 'neutral',
  headingLevel = 2,
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  tone?: 'neutral' | 'danger'
  headingLevel?: 1 | 2 | 3
}) {
  const Heading = `h${headingLevel}` as const
  return (
    <div className={`empty-state empty-state--${tone}`}>
      {icon ? (
        <span className="empty-state__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <Heading className="empty-state__title">{title}</Heading>
      {description ? <div className="empty-state__desc">{description}</div> : null}
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  )
}
