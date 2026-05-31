import { Card } from '../components/Card'

export function About() {
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">About this system</h1>
        <p className="page-lead">
          REM Content Studio — AI-assisted marketing content for real estate, without
          turning the product into a listings marketplace.
        </p>
      </div>

      <div className="about-grid">
        <Card>
          <h2 className="about-card__title">Problem</h2>
          <p className="about-card__body">
            Marketing teams rewrite the same property facts across portals, social,
            email, and video — often with inconsistent tone and wasted time. Briefs live
            in spreadsheets, messages, and PDFs instead of a single structured source.
          </p>
        </Card>
        <Card>
          <h2 className="about-card__title">Objective</h2>
          <p className="about-card__body">
            Provide a workflow that starts from structured property inputs and produces
            channel-specific copy users can review, refine, and export — aligned to brand
            voice and campaign goals.
          </p>
        </Card>
        <Card>
          <h2 className="about-card__title">System features</h2>
          <ul className="about-list">
            <li>Structured property capture (specs, amenities, agent notes)</li>
            <li>Multi-channel generation: listing, social, email, video script</li>
            <li>Tone control: formal, casual, promotional</li>
            <li>Length presets and optional keyword steering</li>
            <li>Review, refinement passes, and export utilities</li>
          </ul>
        </Card>
        <Card>
          <h2 className="about-card__title">Tech stack</h2>
          <ul className="about-list about-list--tags">
            <li>React (this client)</li>
            <li>Python & FastAPI (planned services)</li>
            <li>LLM integration (planned for production generation)</li>
          </ul>
          <p className="about-card__note">
            The current interface uses simulated generation for presentation and
            usability testing; backend services can swap in without changing the core
            workflow.
          </p>
        </Card>
      </div>
    </div>
  )
}
