import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import './choice.css'

export interface Choice<T extends string> {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

/**
 * A radio group rendered as selectable cards. Uses native radio inputs, so arrow keys,
 * Tab and screen readers behave as expected.
 */
export function ChoiceGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  columns = 2,
  compact = false,
}: {
  legend: string
  hint?: string
  name: string
  options: Choice<T>[]
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3 | 4
  compact?: boolean
}) {
  return (
    <fieldset className="choice-group">
      <legend className="choice-group__legend">{legend}</legend>
      {hint ? <p className="choice-group__hint">{hint}</p> : null}
      <div
        className={`choice-group__grid choice-group__grid--${columns} ${compact ? 'choice-group__grid--compact' : ''}`.trim()}
      >
        {options.map((o) => {
          const checked = o.value === value
          return (
            <label key={o.value} className="choice">
              <input
                type="radio"
                className="choice__input sr-only"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              <span className="choice__card">
                {o.icon ? <span className="choice__icon" aria-hidden>{o.icon}</span> : null}
                <span className="choice__text">
                  <span className="choice__label">{o.label}</span>
                  {o.description ? (
                    <span className="choice__desc">{o.description}</span>
                  ) : null}
                </span>
                <span className="choice__check" aria-hidden>
                  <Check />
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Multi-select version of ChoiceGroup: selectable cards backed by native checkboxes. */
export function CheckboxGroup<T extends string>({
  legend,
  hint,
  name,
  options,
  values,
  onChange,
  columns = 2,
}: {
  legend: string
  hint?: string
  name: string
  options: Choice<T>[]
  values: T[]
  onChange: (values: T[]) => void
  columns?: 2 | 3 | 4
}) {
  return (
    <fieldset className="choice-group">
      <legend className="choice-group__legend">{legend}</legend>
      {hint ? <p className="choice-group__hint">{hint}</p> : null}
      <div className={`choice-group__grid choice-group__grid--${columns}`}>
        {options.map((o) => {
          const checked = values.includes(o.value)
          return (
            <label key={o.value} className="choice choice--checkbox">
              <input
                type="checkbox"
                className="choice__input sr-only"
                name={name}
                value={o.value}
                checked={checked}
                onChange={() =>
                  onChange(checked ? values.filter((v) => v !== o.value) : [...values, o.value])
                }
              />
              <span className="choice__card">
                {o.icon ? <span className="choice__icon" aria-hidden>{o.icon}</span> : null}
                <span className="choice__text">
                  <span className="choice__label">{o.label}</span>
                  {o.description ? <span className="choice__desc">{o.description}</span> : null}
                </span>
                <span className="choice__check" aria-hidden>
                  <Check />
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
