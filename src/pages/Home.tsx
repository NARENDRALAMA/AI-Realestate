import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Gauge,
  LayoutGrid,
  Palette,
  Workflow,
} from 'lucide-react'
import { Card } from '../components/Card'

const features = [
  {
    title: 'Structured Property Input',
    desc: 'Capture specs, amenities, and agent notes in one guided form.',
    icon: LayoutGrid,
  },
  {
    title: 'Multi-Channel Content Generation',
    desc: 'Listing copy, social posts, email, and video scripts from the same source.',
    icon: FileText,
  },
  {
    title: 'Tone Customisation',
    desc: 'Formal, casual, or promotional voice—consistent across every channel.',
    icon: Palette,
  },
  {
    title: 'Fast Content Creation',
    desc: 'Generate channel-ready drafts in seconds, then refine and export.',
    icon: Gauge,
  },
]

export function Home() {
  return (
    <div className="page page--home">
      <section className="hero">
        <div className="hero__badge">Marketing content workspace</div>
        <h1 className="hero__title">
          AI-Powered Real Estate Marketing Content Generation System
        </h1>
        <p className="hero__subtitle">
          AI-powered real estate marketing content generator — structured property
          data in, polished listing and campaign copy out.
        </p>
        <div className="hero__actions">
          <Link to="/property" className="btn btn--primary">
            Start Generating
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link to="/workflow" className="btn btn--ghost">
            <Workflow size={18} aria-hidden />
            View workflow
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Core capabilities</h2>
        <div className="feature-grid">
          {features.map(({ title, desc, icon: Icon }) => (
            <Card key={title}>
              <div className="feature-card">
                <span className="feature-card__icon" aria-hidden>
                  <Icon size={22} strokeWidth={1.75} />
                </span>
                <h3 className="feature-card__title">{title}</h3>
                <p className="feature-card__desc">{desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="section section--muted">
        <h2 className="section__title">Workflow preview</h2>
        <div className="workflow-preview">
          <div className="workflow-preview__step">
            <span className="workflow-preview__num">1</span>
            <div>
              <strong>Enter property details</strong>
              <p>Structured fields replace scattered notes and missing specs.</p>
            </div>
          </div>
          <div className="workflow-preview__arrow" aria-hidden />
          <div className="workflow-preview__step">
            <span className="workflow-preview__num">2</span>
            <div>
              <strong>Choose channels & tone</strong>
              <p>Align length and voice with your campaign goals.</p>
            </div>
          </div>
          <div className="workflow-preview__arrow" aria-hidden />
          <div className="workflow-preview__step">
            <span className="workflow-preview__num">3</span>
            <div>
              <strong>Generate & export</strong>
              <p>Review, refine, and ship copy to your stack.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
