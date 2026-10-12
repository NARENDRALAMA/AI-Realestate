import { NavLink } from 'react-router-dom'
import { Download, PenLine } from 'lucide-react'

/** Switches between the two halves of the "Review & export" step. */
export function ReviewNav() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `segmented__item ${isActive ? 'segmented__item--active' : ''}`.trim()
  return (
    <nav className="segmented" aria-label="Review and export">
      <NavLink to="/app/edit" className={cls}>
        <PenLine aria-hidden />
        Edit &amp; refine
      </NavLink>
      <NavLink to="/app/export" className={cls}>
        <Download aria-hidden />
        Export
      </NavLink>
    </nav>
  )
}
