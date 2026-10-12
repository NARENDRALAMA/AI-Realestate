import { useId, useState, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import './tooltip.css'

/**
 * A small "i" button that reveals an explanation on hover, focus or tap.
 * The text is always linked via aria-describedby, so screen readers hear it on focus.
 */
export function InfoTooltip({
  label,
  children,
}: {
  /** Accessible name of the trigger, e.g. "What is template fallback?" */
  label: string
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="tooltip__trigger"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
      >
        <Info aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`tooltip__bubble ${open ? 'tooltip__bubble--open' : ''}`.trim()}
      >
        {children}
      </span>
    </span>
  )
}
