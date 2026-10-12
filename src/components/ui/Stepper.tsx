import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import './stepper.css'

export interface StepperStep {
  id: string
  label: string
  to: string
  status: 'complete' | 'current' | 'upcoming'
  /** When set, the step can't be opened yet and this explains why. */
  disabledReason?: string
}

export function Stepper({ steps }: { steps: StepperStep[] }) {
  const currentIndex = steps.findIndex((s) => s.status === 'current')
  const current = steps[currentIndex]

  return (
    <nav className="stepper" aria-label="Content creation steps">
      <p className="stepper__summary" aria-hidden>
        Step {currentIndex + 1} of {steps.length}
        {current ? <span> · {current.label}</span> : null}
      </p>
      <ol className="stepper__list">
        {steps.map((step, i) => {
          const inner = (
            <>
              <span className="stepper__marker" aria-hidden>
                {step.status === 'complete' ? <Check /> : i + 1}
              </span>
              <span className="stepper__label">{step.label}</span>
              {step.status === 'complete' ? <span className="sr-only"> (done)</span> : null}
            </>
          )
          return (
            <li key={step.id} className={`stepper__item stepper__item--${step.status}`}>
              {step.disabledReason ? (
                <span
                  className="stepper__link stepper__link--disabled"
                  aria-disabled="true"
                  title={step.disabledReason}
                >
                  {inner}
                  <span className="sr-only"> — {step.disabledReason}</span>
                </span>
              ) : (
                <Link
                  to={step.to}
                  className="stepper__link"
                  aria-current={step.status === 'current' ? 'step' : undefined}
                >
                  {inner}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
