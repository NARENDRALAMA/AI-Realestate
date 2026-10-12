import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Mail, Share2, Sparkles, Video } from 'lucide-react'
import { PropertySummary } from '../components/PropertySummary'
import { Alert } from '../components/ui/Alert'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { CheckboxGroup, ChoiceGroup } from '../components/ui/ChoiceGroup'
import { Input } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { StepTips } from '../components/StepTips'
import { useApp } from '../hooks/useApp'
import {
  contentTypeLabel,
  contentTypeOptions,
  extraFormatLabel,
  extraFormatOptions,
  lengthLabel,
  lengthOptions,
  toneLabel,
  toneOptions,
  variationOptions,
} from '../lib/content-options'
import { isPropertyValid } from '../lib/validation'
import type { ContentType } from '../types'

const typeIcons: Record<ContentType, ReactNode> = {
  listing: <FileText />,
  social: <Share2 />,
  email: <Mail />,
  video: <Video />,
}

export function ContentSettings() {
  const { property, settings, setSettings, runGeneration, isGenerating } = useApp()
  const navigate = useNavigate()
  const ready = isPropertyValid(property)
  const pieces = 4 * settings.variations + settings.extraFormats.length

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || isGenerating) return
    navigate('/app/generated')
    await runGeneration()
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 2"
        title="Content settings"
        description="Choose what to focus on and how it should sound. You'll get all four channels either way."
      />

      <StepTips step="settings" />

      <form className="layout-aside" onSubmit={handleSubmit}>
        <div className="stack stack--lg">
          <Card as="section" padding="lg">
            <ChoiceGroup
              legend="Main focus"
              hint="This channel opens first in your results and is used for the library preview."
              name="contentType"
              columns={2}
              value={settings.contentType}
              onChange={(contentType) => setSettings((s) => ({ ...s, contentType }))}
              options={contentTypeOptions.map((o) => ({ ...o, icon: typeIcons[o.value] }))}
            />
          </Card>

          <Card as="section" padding="lg">
            <ChoiceGroup
              legend="Tone of voice"
              hint="Applied consistently across every channel."
              name="tone"
              columns={3}
              value={settings.tone}
              onChange={(tone) => setSettings((s) => ({ ...s, tone }))}
              options={toneOptions}
            />
          </Card>

          <Card as="section" padding="lg" className="stack stack--lg">
            <ChoiceGroup
              legend="Length"
              name="length"
              columns={4}
              compact
              value={settings.length}
              onChange={(length) => setSettings((s) => ({ ...s, length }))}
              options={lengthOptions}
            />
            <Input
              label="Keywords"
              value={settings.keywords}
              onChange={(e) => setSettings((s) => ({ ...s, keywords: e.target.value }))}
              placeholder="e.g. north-facing, walk to schools, EV charger"
              hint="Optional. Comma-separated words or phrases to work into the copy."
            />
          </Card>

          <Card as="section" padding="lg" className="stack stack--lg">
            <ChoiceGroup
              legend="Versions of each channel"
              hint="Get more than one take on each channel and pick the one you like best."
              name="variations"
              columns={3}
              compact
              value={String(settings.variations) as '1' | '2' | '3'}
              onChange={(v) => setSettings((s) => ({ ...s, variations: Number(v) as 1 | 2 | 3 }))}
              options={variationOptions}
            />
            <CheckboxGroup
              legend="Extra formats"
              hint="Optional. Written from the same facts, alongside the four core channels."
              name="extraFormats"
              columns={2}
              values={settings.extraFormats}
              onChange={(extraFormats) => setSettings((s) => ({ ...s, extraFormats }))}
              options={extraFormatOptions}
            />
          </Card>

          <div>
            <LinkButton to="/app/property" variant="ghost" icon={<ArrowLeft aria-hidden />}>
              Back to property details
            </LinkButton>
          </div>
        </div>

        <div className="layout-aside__side">
          <Card as="section" aria-labelledby="generate-title">
            <CardHeader
              level={3}
              titleId="generate-title"
              icon={<Sparkles />}
              title="Ready to generate"
            />
            <dl className="summary-list summary-list--compact">
              <div>
                <dt>Focus</dt>
                <dd>{contentTypeLabel(settings.contentType)}</dd>
              </div>
              <div>
                <dt>Tone</dt>
                <dd>{toneLabel(settings.tone)}</dd>
              </div>
              <div>
                <dt>Length</dt>
                <dd>{lengthLabel(settings.length)}</dd>
              </div>
              <div>
                <dt>Versions</dt>
                <dd>{settings.variations}</dd>
              </div>
              {settings.extraFormats.length ? (
                <div>
                  <dt>Extras</dt>
                  <dd>{settings.extraFormats.map((f) => extraFormatLabel[f]).join(', ')}</dd>
                </div>
              ) : null}
              {settings.keywords.trim() ? (
                <div>
                  <dt>Keywords</dt>
                  <dd>{settings.keywords}</dd>
                </div>
              ) : null}
            </dl>

            {!ready ? (
              <Alert tone="warning" className="generate-card__alert">
                <span id="generate-blocked">
                  Add a listing title and location before generating.
                </span>{' '}
                <Link to="/app/property">Go to property details</Link>
              </Alert>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              icon={<Sparkles aria-hidden />}
              disabled={!ready}
              loading={isGenerating}
              loadingText="Generating…"
              aria-describedby={ready ? 'generate-note' : 'generate-blocked'}
              className="generate-card__button"
            >
              Generate content
            </Button>
            <p className="generate-card__note" id="generate-note">
              Writes {pieces} pieces of content and saves them to your library. You'll see each
              one appear live as it's written. With the AI model, more versions and formats take
              longer.
            </p>
          </Card>

          <PropertySummary property={property} />
        </div>
      </form>
    </>
  )
}
