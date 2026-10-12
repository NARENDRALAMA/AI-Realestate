import { useId, useRef, type KeyboardEvent } from 'react'
import { m } from 'motion/react'
import './segmented-toggle.css'

/**
 * Single-choice toggle (radiogroup). Arrow keys move and select, like native radios.
 */
export function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value)
    let next = i
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + options.length) % options.length
    else return
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className="seg-toggle" role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className={`seg-toggle__option ${checked ? 'seg-toggle__option--checked' : ''}`.trim()}
            onClick={() => onChange(o.value)}
          >
            {checked ? (
              <m.span
                className="seg-toggle__thumb"
                layoutId={`${base}-thumb`}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                aria-hidden
              />
            ) : null}
            <span className="seg-toggle__label">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
