import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Lightbulb, X } from 'lucide-react'
import { stepTips, type TipStep } from '../content/tips'
import { readHiddenTips, writeHiddenTips } from '../lib/tips-storage'
import './guides.css'

/** A dismissible card of short tips for one step, linking to the matching guide. */
export function StepTips({ step }: { step: TipStep }) {
  const [hidden, setHidden] = useState(() => readHiddenTips().includes(step))
  if (hidden) return null
  const { tips, guide, guideTitle } = stepTips[step]

  return (
    <aside className="step-tips" aria-label="Tips for this step">
      <Lightbulb className="step-tips__icon" aria-hidden />
      <div className="step-tips__body">
        <p className="step-tips__title">Tips</p>
        <ul className="step-tips__list">
          {tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <Link to={`/app/learn/${guide}`} className="inline-link step-tips__link">
          Guide: {guideTitle}
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        className="step-tips__close"
        aria-label="Hide tips for this step"
        onClick={() => {
          writeHiddenTips([...readHiddenTips(), step])
          setHidden(true)
        }}
      >
        <X aria-hidden />
      </button>
    </aside>
  )
}
