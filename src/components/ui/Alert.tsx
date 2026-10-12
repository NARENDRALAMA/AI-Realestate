import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import './alert.css'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
}

/**
 * Inline message. Danger alerts use role="alert" so they are announced when they appear;
 * the others are polite status messages.
 */
export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  className,
}: {
  tone?: Tone
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const Icon = icons[tone]
  return (
    <div
      className={`alert alert--${tone} ${className ?? ''}`.trim()}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon className="alert__icon" aria-hidden />
      <div className="alert__body">
        {title ? <p className="alert__title">{title}</p> : null}
        {children ? <div className="alert__text">{children}</div> : null}
        {actions ? <div className="alert__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
