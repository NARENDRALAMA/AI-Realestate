import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  FileText,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Wand2,
  Zap,
} from 'lucide-react'
import { GuideGrid } from '../components/GuideArticle'
import { StartNewDialog } from '../components/StartNewDialog'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { SkeletonText } from '../components/ui/Skeleton'
import { StatCard } from '../components/ui/StatCard'
import { useApp } from '../hooks/useApp'
import { useAsync } from '../hooks/useAsync'
import { fetchStats } from '../lib/api'
import { channelLabels, toneLabel } from '../lib/content-options'
import { resumePath } from '../lib/flow'
import { formatServerDate } from '../lib/format'
import type { ContentType } from '../types'

const steps = [
  { title: 'Property details', desc: 'Enter the facts once: specs, features and notes.' },
  { title: 'Content settings', desc: 'Pick a focus channel, tone and length.' },
  { title: 'Generate', desc: 'Get listing, social, email and video copy together.' },
  { title: 'Review & export', desc: 'Refine, copy, or download as PDF, Word or text.' },
]

const capabilities = [
  { icon: Layers, title: 'One input, four channels', desc: 'Listing, social post, email and video script from the same details.' },
  { icon: Palette, title: 'Six tones of voice', desc: 'From formal to luxury, applied consistently everywhere.' },
  { icon: Zap, title: 'Quick refinements', desc: 'Improve tone, add persuasion or shorten with one click.' },
  { icon: Share2, title: 'Ready to publish', desc: 'Copy per channel or export the full pack.' },
]

export function Home() {
  const { property, generated, isGenerating, loadSampleProperty } = useApp()
  const navigate = useNavigate()
  const stats = useAsync(fetchStats)
  const [confirmNew, setConfirmNew] = useState(false)

  const hasDraft = !!property.title.trim() || !!generated

  return (
    <div className="page">
      <PageHeader
        eyebrow="REM Content Studio"
        title="Property marketing copy, in minutes"
        description="Turn a property's details into listing, social, email and video copy in your chosen tone."
      />

      <Card tone="primary" padding="lg" className="hero-card">
        {hasDraft ? (
          <>
            <div className="hero-card__text">
              <Badge tone="primary">{generated ? 'Content ready' : 'Draft in progress'}</Badge>
              <h2 className="hero-card__title">{property.title.trim() || 'Untitled property'}</h2>
              <p className="text-muted">
                {generated
                  ? 'Pick up where you left off: review, refine or export your copy.'
                  : 'Your property details are saved in this session. Continue to generate your copy.'}
              </p>
            </div>
            <div className="hero-card__actions" data-tour="home-start">
              <LinkButton
                to={resumePath({ generated, isGenerating })}
                variant="primary"
                size="lg"
                iconAfter={<ArrowRight aria-hidden />}
              >
                Continue
              </LinkButton>
              <Button variant="secondary" size="lg" icon={<Plus aria-hidden />} onClick={() => setConfirmNew(true)}>
                Start new
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="hero-card__text">
              <h2 className="hero-card__title">Create your first listing content</h2>
              <p className="text-muted">It takes about two minutes. You'll review everything before it's used.</p>
            </div>
            <div className="hero-card__actions" data-tour="home-start">
              <LinkButton to="/app/property" variant="primary" size="lg" iconAfter={<ArrowRight aria-hidden />}>
                Start new content
              </LinkButton>
              <Button
                variant="secondary"
                size="lg"
                icon={<Wand2 aria-hidden />}
                onClick={() => {
                  loadSampleProperty()
                  navigate('/app/property')
                }}
              >
                Try a sample property
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="layout-aside section">
        <Card as="section" padding="lg" aria-labelledby="recent-title">
          <CardHeader
            titleId="recent-title"
            icon={<BookOpen />}
            title="Recent activity"
            actions={
              <LinkButton to="/app/library" variant="ghost" size="sm" iconAfter={<ArrowRight aria-hidden />}>
                Open library
              </LinkButton>
            }
          />
          {stats.status === 'error' ? (
            <Alert
              tone="danger"
              title="Couldn't load recent activity"
              actions={
                <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden />} onClick={stats.reload}>
                  Try again
                </Button>
              }
            >
              {stats.error}
            </Alert>
          ) : !stats.data ? (
            <div aria-busy="true">
              <span className="sr-only">Loading recent activity…</span>
              <SkeletonText lines={4} />
            </div>
          ) : stats.data.recent.length === 0 ? (
            <p className="text-muted">Nothing generated yet. Your recent content will show up here.</p>
          ) : (
            <ul className="activity-list">
              {stats.data.recent.map((r, i) => (
                <li key={`${r.created_at}-${i}`} className="activity-list__item">
                  <FileText className="activity-list__icon" aria-hidden />
                  <span className="activity-list__main">
                    <span className="activity-list__title">{r.title}</span>
                    <span className="activity-list__meta">
                      {channelLabels[r.content_type as ContentType] ?? r.content_type} ·{' '}
                      {toneLabel(r.tone)}
                    </span>
                  </span>
                  <span className="activity-list__date">{formatServerDate(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="layout-aside__side">
          <StatCard
            label="Total generated"
            icon={<Layers />}
            value={stats.data?.total ?? 0}
            loading={!stats.data && stats.status === 'loading'}
          />
          <StatCard
            label="This week"
            icon={<CalendarDays />}
            value={stats.data?.this_week ?? 0}
            hint="Last 7 days"
            loading={!stats.data && stats.status === 'loading'}
          />
        </div>
      </div>

      <section className="section" aria-labelledby="how-title">
        <div className="cluster cluster--between section-head">
          <h2 id="how-title" className="section-title">
            How it works
          </h2>
          <LinkButton to="/app/workflow" variant="ghost" size="sm" iconAfter={<ArrowRight aria-hidden />}>
            More detail
          </LinkButton>
        </div>
        <ol className="step-grid">
          {steps.map((s, i) => (
            <li key={s.title} className="step-grid__item">
              <span className="step-grid__num" aria-hidden>
                {i + 1}
              </span>
              <h3 className="step-grid__title">{s.title}</h3>
              <p className="step-grid__desc">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="learn-title">
        <div className="cluster cluster--between section-head">
          <h2 id="learn-title" className="section-title">
            Guides to get you started
          </h2>
          <LinkButton to="/app/learn" variant="ghost" size="sm" iconAfter={<ArrowRight aria-hidden />}>
            All guides
          </LinkButton>
        </div>
        <GuideGrid base="/app/learn" limit={3} />
      </section>

      <section className="section" aria-labelledby="cap-title">
        <h2 id="cap-title" className="section-title section-head">
          What you get
        </h2>
        <ul className="feature-grid">
          {capabilities.map(({ icon: Icon, title, desc }) => (
            <li key={title} className="feature">
              <Icon className="feature__icon" aria-hidden />
              <h3 className="feature__title">{title}</h3>
              <p className="feature__desc">{desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <StartNewDialog open={confirmNew} onClose={() => setConfirmNew(false)} />
    </div>
  )
}
