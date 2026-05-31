import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Card } from '../components/Card'

const steps = [
  {
    n: 1,
    title: 'Input property data',
    desc: 'Structured fields capture specs, amenities, and agent notes.',
    to: '/property',
  },
  {
    n: 2,
    title: 'Select content type & tone',
    desc: 'Choose channel focus, voice, length, and optional keywords.',
    to: '/settings',
  },
  {
    n: 3,
    title: 'Generate content',
    desc: 'Produce listing, social, email, and video drafts in one pass.',
    to: '/generated',
  },
  {
    n: 4,
    title: 'Format output',
    desc: 'Refine tone, persuasion, and length; track version checkpoints.',
    to: '/edit',
  },
  {
    n: 5,
    title: 'Review and export',
    desc: 'Copy, download, or save the final pack for your marketing stack.',
    to: '/export',
  },
]

export function Workflow() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">System workflow</h1>
        <p className="page-lead">
          End-to-end flow from structured input to export — built for real estate
          marketing teams.
        </p>
      </div>

      <div className="stepper">
        {steps.map((s, i) => (
          <div key={s.n} className="stepper__row">
            <div className="stepper__track" aria-hidden>
              <span className="stepper__num">{s.n}</span>
              {i < steps.length - 1 ? <span className="stepper__line" /> : null}
            </div>
            <Card className="stepper__card">
              <div className="step-card">
                <div>
                  <h2 className="step-card__title">{s.title}</h2>
                  <p className="step-card__desc">{s.desc}</p>
                  <Link to={s.to} className="step-card__link">
                    Open step
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
