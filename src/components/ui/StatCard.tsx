import type { ReactNode } from 'react'
import { Skeleton } from './Skeleton'
import './stat.css'

export function StatCard({
  label,
  value,
  hint,
  icon,
  loading = false,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: ReactNode
  loading?: boolean
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <p className="stat-card__label">{label}</p>
        {icon ? <span className="stat-card__icon" aria-hidden>{icon}</span> : null}
      </div>
      {loading ? (
        <Skeleton variant="stat" />
      ) : (
        <p className="stat-card__value">{value}</p>
      )}
      {hint && !loading ? <p className="stat-card__hint">{hint}</p> : null}
    </div>
  )
}

/** Ranked list with proportion bars. Counts and percentages are in the text, bars are decorative. */
export function BarList({
  items,
  emptyText = 'No data yet.',
}: {
  items: { label: string; value: number }[]
  emptyText?: string
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0)
  if (items.length === 0 || total === 0) {
    return <p className="bar-list__empty">{emptyText}</p>
  }
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const max = sorted[0].value
  return (
    <ul className="bar-list">
      {sorted.map((item) => {
        const pct = Math.round((item.value / total) * 100)
        return (
          <li key={item.label} className="bar-list__item">
            <div className="bar-list__row">
              <span className="bar-list__label">{item.label}</span>
              <span className="bar-list__value">
                {item.value} <span className="text-muted">({pct}%)</span>
              </span>
            </div>
            <span className="bar-list__track" aria-hidden>
              <span
                className="bar-list__fill"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
