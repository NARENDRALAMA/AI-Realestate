import type { ReactNode } from 'react'
import './page-header.css'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Extra row under the description, e.g. badges. */
  children?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__desc">{description}</p> : null}
        {children ? <div className="page-header__meta">{children}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
