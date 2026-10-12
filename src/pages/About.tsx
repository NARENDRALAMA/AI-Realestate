import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { toneOptions } from '../lib/content-options'

export function About() {
  return (
    <div className="page page--narrow">
      <PageHeader
        title="About REM Content Studio"
        description="Marketing copy for real estate teams, built from one structured set of property details."
      />

      <div className="stack stack--lg">
        <Card as="section" padding="lg">
          <CardHeader title="The problem" />
          <p>
            Agents and marketing teams rewrite the same property facts for portals, social,
            email and video, often with inconsistent tone and a lot of lost time. Briefs live
            in spreadsheets, messages and PDFs rather than one reliable source.
          </p>
        </Card>

        <Card as="section" padding="lg">
          <CardHeader title="What it does" />
          <p>
            You enter the property once. The studio writes channel-specific copy you can
            review, refine and export, in a consistent voice that suits the campaign.
          </p>
          <ul className="check-list">
            <li>Structured property details: specs, features, amenities, agent notes and a photo</li>
            <li>Four channels per run: listing, social post, email and video script</li>
            <li>Three lengths and optional keywords</li>
            <li>Refinements: improve tone, make more persuasive, shorten</li>
            <li>Export to PDF, Word or plain text, and a searchable library of past work</li>
          </ul>
          <div className="cluster about-tones">
            <span className="text-sm text-muted">Tones:</span>
            {toneOptions.map((t) => (
              <Badge key={t.value}>{t.label}</Badge>
            ))}
          </div>
        </Card>

        <Card as="section" padding="lg">
          <CardHeader title="How it's built" />
          <ul className="check-list">
            <li>React and TypeScript web app</li>
            <li>Python FastAPI service with a SQLite library</li>
            <li>
              Grounded LangChain prompts, one per channel, sent to an open-source instruction-tuned
              model (Mistral 7B Instruct by default) — hosted on Colab, run locally with Transformers,
              or served by Ollama
            </li>
            <li>
              Channels are generated concurrently; any that time out or fail fall back to the template
              engine, and each result records which engine was used and how long it took
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
