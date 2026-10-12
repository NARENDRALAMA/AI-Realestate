import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { AlertCircle } from 'lucide-react'
import './field.css'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string
  required?: boolean
  /** Visually hide the label but keep it for screen readers. */
  hideLabel?: boolean
  className?: string
  /** Extra content shown on the right of the label row (e.g. a counter). */
  aside?: ReactNode
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  aside,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`field ${error ? 'field--invalid' : ''} ${className ?? ''}`.trim()}>
      <div className={`field__label-row ${hideLabel ? 'sr-only' : ''}`.trim()}>
        <label className="field__label" htmlFor={id}>
          {label}
          {required ? (
            <>
              <span className="field__required" aria-hidden>
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>
        {aside ? <span className="field__aside">{aside}</span> : null}
      </div>
      {children}
      {hint && !error ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <AlertCircle aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  )
}

function describedBy(id: string, hint: unknown, error: unknown) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

type InputProps = FieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'required'> & { id?: string }

export function Input({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  aside,
  id: idProp,
  ...rest
}: InputProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell {...{ id, label, hint, error, required, hideLabel, className, aside }}>
      <input
        id={id}
        className="control"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  )
}

type TextareaProps = FieldProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'required'> & { id?: string }

export function Textarea({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  aside,
  id: idProp,
  ...rest
}: TextareaProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell {...{ id, label, hint, error, required, hideLabel, className, aside }}>
      <textarea
        id={id}
        className="control control--textarea"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  )
}

type SelectProps = FieldProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'required'> & {
    id?: string
    options: { value: string; label: string }[]
  }

export function Select({
  label,
  hint,
  error,
  required,
  hideLabel,
  className,
  aside,
  id: idProp,
  options,
  ...rest
}: SelectProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  return (
    <FieldShell {...{ id, label, hint, error, required, hideLabel, className, aside }}>
      <select
        id={id}
        className="control control--select"
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
