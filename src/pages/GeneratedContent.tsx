import { useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  PenLine,
  RefreshCw,
  Square,
  Sparkles,
} from 'lucide-react'
import { ChannelPanel, ExtraPanel, VersionPicker } from '../components/ChannelPanel'
import { EngineBadge } from '../components/EngineBadge'
import { GenerationProgress } from '../components/GenerationProgress'
import { PropertySummary } from '../components/PropertySummary'
import { Badge } from '../components/ui/Badge'
import { Button, LinkButton } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { StepTips } from '../components/StepTips'
import { useApp } from '../hooks/useApp'
import {
  channelLabels,
  CHANNELS,
  contentTypeLabel,
  extraFormatLabel,
  lengthLabel,
  toneLabel,
} from '../lib/content-options'
import type { ExtraFormat, GeneratedBundle } from '../types'

export function GeneratedContent() {
  const {
    property,
    settings,
    generated,
    drafts,
    isGenerating,
    generationError,
    generationFieldErrors,
    generationStartedAt,
    generationMeta,
    runGeneration,
    live,
    stopGeneration,
    generationStopped,
    extras,
    versions,
    selectVersion,
  } = useApp()
  const [tab, setTab] = useState<string>(settings.contentType)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const bundle = drafts ?? generated
  const extraKeys = Object.keys(extras) as ExtraFormat[]
  const hasEdits =
    !!drafts && !!generated && CHANNELS.some((c) => drafts[c] !== generated[c])

  if (isGenerating && generationStartedAt !== null) {
    return (
      <GenerationProgress
        startedAt={generationStartedAt}
        live={live}
        onStop={stopGeneration}
        focus={settings.contentType}
      />
    )
  }

  if (generationStopped && !generated) {
    return (
      <Card padding="lg">
        <EmptyState
          headingLevel={1}
          icon={<Square />}
          title="Generation stopped"
          description="You stopped this run before it finished, so nothing was saved to your library."
          actions={
            <>
              <LinkButton to="/app/settings" variant="secondary">
                Change settings
              </LinkButton>
              <Button variant="primary" icon={<RefreshCw aria-hidden />} onClick={() => runGeneration()}>
                Generate again
              </Button>
            </>
          }
        />
      </Card>
    )
  }

  if (generationError) {
    const fieldProblem = Object.keys(generationFieldErrors).length > 0
    return (
      <Card padding="lg">
        <EmptyState
          headingLevel={1}
          tone="danger"
          icon={<AlertCircle />}
          title="We couldn't generate your content"
          description={generationError}
          actions={
            <>
              {fieldProblem ? (
                <LinkButton to="/app/property" variant="secondary">
                  Fix property details
                </LinkButton>
              ) : (
                <LinkButton to="/app/settings" variant="secondary">
                  Back to settings
                </LinkButton>
              )}
              <Button variant="primary" icon={<RefreshCw aria-hidden />} onClick={() => runGeneration()}>
                Try again
              </Button>
            </>
          }
        />
      </Card>
    )
  }

  if (!bundle) {
    return (
      <Card padding="lg">
        <EmptyState
          headingLevel={1}
          icon={<Sparkles />}
          title="No content yet"
          description="Add your property details and choose your settings, then generate to see your copy here."
          actions={
            <LinkButton to="/app/property" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
              Start with property details
            </LinkButton>
          }
        />
      </Card>
    )
  }

  const regenerate = () => {
    setConfirmOpen(false)
    void runGeneration()
  }

  return (
    <>
      <PageHeader
        eyebrow="Step 3"
        title="Your content is ready"
        description={`${toneLabel(settings.tone)} tone · ${lengthLabel(settings.length)} length · focus on ${contentTypeLabel(settings.contentType).toLowerCase()}`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden />}
              onClick={() => (hasEdits ? setConfirmOpen(true) : regenerate())}
            >
              Regenerate
            </Button>
            <LinkButton to="/app/export" variant="secondary" icon={<Download aria-hidden />}>
              Export
            </LinkButton>
            <LinkButton to="/app/edit" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
              Review &amp; refine
            </LinkButton>
          </>
        }
      >
        {generationMeta ? <EngineBadge meta={generationMeta} /> : null}
        <Badge tone="success" icon={<CheckCircle2 aria-hidden />}>
          Saved to library
        </Badge>
        {hasEdits ? <Badge tone="primary">Showing your edits</Badge> : null}
      </PageHeader>

      <StepTips step="results" />

      <div className="layout-aside">
        <Card padding="lg">
          <Tabs
            label="Generated channels"
            value={tab}
            onChange={setTab}
            items={[
              ...CHANNELS.map((ch) => ({
                id: ch as string,
                label: channelLabels[ch],
                meta:
                  ch === settings.contentType ? (
                    <Badge tone="accent" className="tab-badge">
                      Focus
                    </Badge>
                  ) : undefined,
              })),
              ...extraKeys.map((fmt) => ({
                id: `extra:${fmt}`,
                label: extraFormatLabel[fmt],
                meta: (
                  <Badge tone="neutral" className="tab-extra">
                    Extra
                  </Badge>
                ),
              })),
            ]}
          >
            {tab.startsWith('extra:') ? (
              <ExtraPanel format={tab.slice(6) as ExtraFormat} text={extras[tab.slice(6) as ExtraFormat] ?? ''} />
            ) : (
              <ChannelPanel
                channel={tab as keyof GeneratedBundle}
                text={bundle[tab as keyof GeneratedBundle]}
                actions={
                  <>
                    <VersionPicker
                      count={versions[tab as keyof GeneratedBundle]?.length ?? 1}
                      selected={
                        versions[tab as keyof GeneratedBundle]?.indexOf(bundle[tab as keyof GeneratedBundle]) ?? 0
                      }
                      onSelect={(i) => selectVersion(tab as keyof GeneratedBundle, i)}
                    />
                    <LinkButton
                      to={`/app/edit?channel=${tab}`}
                      variant="ghost"
                      size="sm"
                      icon={<PenLine aria-hidden />}
                    >
                      Edit
                    </LinkButton>
                  </>
                }
              />
            )}
          </Tabs>
        </Card>

        <div className="layout-aside__side">
          <PropertySummary property={property} />
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Replace your edits?"
        description="Regenerating writes fresh copy for all four channels. Your current edits will be replaced."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} data-autofocus>
              Keep my edits
            </Button>
            <Button variant="danger" icon={<RefreshCw aria-hidden />} onClick={regenerate}>
              Regenerate
            </Button>
          </>
        }
      />
    </>
  )
}
