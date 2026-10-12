import type { HTMLAttributes, ReactNode } from 'react'
import './card.css'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside'
  padding?: 'none' | 'md' | 'lg'
  tone?: 'default' | 'muted' | 'primary'
}

export function Card({
  as: Tag = 'div',
  padding = 'md',
  tone = 'default',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={`card card--pad-${padding} card--${tone} ${className ?? ''}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  titleId,
  level = 2,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  titleId?: string
  level?: 2 | 3
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="card-header">
      <div className="card-header__text">
        <Heading className="card-header__title" id={titleId}>
          {icon ? <span className="card-header__icon" aria-hidden>{icon}</span> : null}
          {title}
        </Heading>
        {description ? <p className="card-header__desc">{description}</p> : null}
      </div>
      {actions ? <div className="card-header__actions">{actions}</div> : null}
    </div>
  )
}
