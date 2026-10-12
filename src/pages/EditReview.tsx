import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  FileSearch,
  History,
  Minimize2,
  RotateCcw,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { ChannelCounts } from '../components/ChannelPanel'
import { ReviewNav } from '../components/ReviewNav'
import { Alert } from '../components/ui/Alert'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Textarea } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { StepTips } from '../components/StepTips'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { channelLabels, CHANNELS } from '../lib/content-options'
import type { GeneratedBundle } from '../types'

type RefineOp = 'tone' | 'persuasive' | 'shorten'
type Scope = 'one' | 'all'

const ops: { id: RefineOp; label: string; icon: LucideIcon }[] = [
  { id: 'tone', label: 'Improve tone', icon: Sparkles },
  { id: 'persuasive', label: 'More persuasive', icon: TrendingUp },
  { id: 'shorten', label: 'Shorten', icon: Minimize2 },
]

const isChannel = (v: string | null): v is keyof GeneratedBundle =>
  !!v && (CHANNELS as string[]).includes(v)

export function EditReview() {
  const {
    settings,
    drafts,
    setDrafts,
    versionHistory,
    applyImproveTone,
    applyPersuasive,
    applyShorten,
    applyImproveAll,
    applyPersuasiveAll,
    applyShortenAll,
    finalizeEdits,
  } = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const initial = params.get('channel')
  const [tab, setTab] = useState<keyof GeneratedBundle>(
    isChannel(initial) ? initial : settings.contentType,
  )
  const [busy, setBusy] = useState<{ op: RefineOp; scope: Scope } | null>(null)
  const [error, setError] = useState<{ title: string; message: string; retry: () => void } | null>(null)

  if (!drafts) {
    return (
      <>
        <ReviewNav />
        <Card padding="lg">
          <EmptyState
            headingLevel={1}
            icon={<FileSearch />}
            title="Nothing to review yet"
            description="Generate content first, then come back here to edit, refine and export it."
            actions={
              <LinkButton to="/app/property" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
                Start with property details
              </LinkButton>
            }
          />
        </Card>
      </>
    )
  }

  const fns = {
    tone: { one: applyImproveTone, all: applyImproveAll },
    persuasive: { one: applyPersuasive, all: applyPersuasiveAll },
    shorten: { one: applyShorten, all: applyShortenAll },
  }

  const run = async (op: RefineOp, scope: Scope, channel: keyof GeneratedBundle) => {
    const label = ops.find((o) => o.id === op)?.label ?? op
    const target = scope === 'one' ? channelLabels[channel] : 'all channels'
    setBusy({ op, scope })
    setError(null)
    try {
      if (scope === 'one') await fns[op].one(channel)
      else await fns[op].all()
      toast.show(`${label}: applied to ${target.toLowerCase()}`)
    } catch (err) {
      setError({
        title: `${label} didn't work for ${target.toLowerCase()}`,
        message: err instanceof Error ? err.message : 'Something went wrong.',
        retry: () => void run(op, scope, channel),
      })
    } finally {
      setBusy(null)
    }
  }

  const renderOps = (scope: Scope, block = false) =>
    ops.map(({ id, label, icon: Icon }) => (
      <Button
        key={id}
        size={block ? 'md' : 'sm'}
        block={block}
        variant="secondary"
        icon={<Icon aria-hidden />}
        loading={busy?.op === id && busy.scope === scope}
        disabled={busy !== null}
        onClick={() => void run(id, scope, tab)}
      >
        {label}
      </Button>
    ))

  return (
    <>
      <ReviewNav />
      <PageHeader
        eyebrow="Step 4"
        title="Review and refine"
        description="Edit the copy directly or use a quick refinement. Changes are kept until you regenerate."
        actions={
          <Button
            variant="primary"
            iconAfter={<ArrowRight aria-hidden />}
            onClick={() => {
              finalizeEdits(drafts)
              toast.show('Edits saved for export')
              navigate('/app/export')
            }}
          >
            Continue to export
          </Button>
        }
      />

      <StepTips step="edit" />

      {error ? (
        <Alert
          tone="danger"
          title={error.title}
          className="page-alert"
          actions={
            <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden />} onClick={error.retry}>
              Try again
            </Button>
          }
        >
          {error.message}
        </Alert>
      ) : null}

      <div className="layout-aside">
        <Card padding="lg">
          <Tabs
            label="Channels to edit"
            value={tab}
            onChange={setTab}
            items={CHANNELS.map((ch) => ({ id: ch, label: channelLabels[ch] }))}
          >
            <div className="stack">
              <Textarea
                label={`${channelLabels[tab]} copy`}
                aside={<ChannelCounts channel={tab} text={drafts[tab]} />}
                className="editor"
                rows={14}
                value={drafts[tab]}
                disabled={busy !== null}
                onChange={(e) =>
                  setDrafts((d) => (d ? { ...d, [tab]: e.target.value } : d))
                }
              />
              <div className="refine-bar" role="group" aria-label={`Refine ${channelLabels[tab]}`}>
                <span className="refine-bar__label">Refine this channel</span>
                <div className="cluster">{renderOps('one')}</div>
              </div>
            </div>
          </Tabs>
        </Card>

        <div className="layout-aside__side">
          <Card as="section" aria-labelledby="refine-all-title">
            <CardHeader
              level={3}
              titleId="refine-all-title"
              icon={<Sparkles />}
              title="Refine all channels"
              description="Apply one change to listing, social, email and video at once."
            />
            <div className="stack stack--sm">{renderOps('all', true)}</div>
          </Card>

          <Card as="section" aria-labelledby="history-title">
            <CardHeader level={3} titleId="history-title" icon={<History />} title="Version history" />
            {versionHistory.length === 0 ? (
              <p className="text-muted text-sm">No changes yet.</p>
            ) : (
              <ol className="timeline">
                {versionHistory.map((v) => (
                  <li key={v.id} className="timeline__item">
                    <span className="timeline__label">{v.label}</span>
                    <span className="timeline__time">{v.at}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
