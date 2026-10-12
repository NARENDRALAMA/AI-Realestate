import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import './breadcrumbs.css'

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label}>
              {item.to && !last ? (
                <Link to={item.to}>{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
              {!last ? <ChevronRight aria-hidden /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
