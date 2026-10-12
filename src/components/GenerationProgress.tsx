import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import {
  Check,
  Clock3,
  Cpu,
  FileText,
  Lightbulb,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Search,
  Share2,
  Sparkles,
  Square,
  Video,
  Heading,
  type LucideIcon,
} from 'lucide-react'
import type { LiveGeneration, LiveJob } from '../context/app-state'
import { jobLabel } from '../lib/content-options'
import { countWords, formatNumber } from '../lib/format'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Skeleton } from './ui/Skeleton'
import './live.css'

const jobIcons: Record<string, LucideIcon> = {
  listing: FileText,
  social: Share2,
  email: Mail,
  video: Video,
  headlines: Heading,
  facebook_ad: Megaphone,
  sms: MessageSquare,
  flyer: FileText,
  seo: Search,
}

const TIPS = [
  'Specific beats general: “north-facing courtyard” sells better than “great outdoor space”.',
  'Put your strongest feature first in the features list — it leads the listing.',
  'Keywords are woven in where they fit. Two or three focused phrases work best.',
  'AI can still get details wrong. Check every number and claim against your notes.',
  'Social posts vary in length. Use the character count to fit each platform.',
  'Refinements work per channel, so you can shorten the social post without touching the listing.',
  'Asked for versions? Pick the one you like on the results screen, then edit it.',
]

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function JobCard({ job, state, variations }: { job: string; state: LiveJob; variations: number }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const kind = job.startsWith('extra:') ? job.slice(6) : job.split(':')[0]
  const Icon = jobIcons[kind] ?? FileText
  const label = jobLabel(job, variations)
  const words = countWords(state.text)

  // Follow the text as it grows, unless the reader has scrolled up to re-read.
  useEffect(() => {
    const el = bodyRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [state.text])

  return (
    <m.li
      className={`live-job live-job--${state.status}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      aria-busy={state.status !== 'done'}
    >
      <div className="live-job__head">
        <Icon className="live-job__icon" aria-hidden />
        <span className="live-job__name">{label}</span>
        <span className="live-job__status">
          {state.status === 'waiting' ? (
            <>
              <Clock3 aria-hidden /> Waiting
            </>
          ) : state.status === 'writing' ? (
            <>
              <span className="live-job__pulse" aria-hidden /> Writing
            </>
          ) : state.source === 'ai' ? (
            <>
              <Check aria-hidden /> Done · AI
            </>
          ) : (
            <>
              <Cpu aria-hidden /> Template
            </>
          )}
        </span>
      </div>
      <div
        ref={bodyRef}
        className="live-job__body"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
      >
        {state.text ? (
          <p className="live-job__text">
            {state.text}
            {state.status === 'writing' ? <span className="live-caret" aria-hidden /> : null}
          </p>
        ) : (
          <div className="live-job__waiting" aria-hidden>
            <Skeleton />
            <Skeleton />
            <Skeleton width="55%" />
          </div>
        )}
      </div>
      <div className="live-job__foot">
        <span className="tabular">{formatNumber(words)} words</span>
        {state.status === 'done' && state.source === 'template' ? (
          <span>The model didn’t finish this one, so it was built from templates.</span>
        ) : null}
      </div>
    </m.li>
  )
}

/**
 * Live generation: every channel (and version / extra format) as its own card, with the
 * text appearing as the model writes it. Honest about the engine: template output is
 * shown as template output, never animated as if it were typed.
 */
export function GenerationProgress({
  startedAt,
  live,
  onStop,
  focus,
}: {
  startedAt: number
  live: LiveGeneration | null
  onStop: () => void
  /** The user's main-focus channel, shown first. */
  focus: string
}) {
  const [now, setNow] = useState(startedAt)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  const tip = TIPS[Math.floor(seconds / 7) % TIPS.length]

  const jobs = live
    ? [...live.jobs].sort((a, b) => Number(!a.startsWith(`${focus}:`)) - Number(!b.startsWith(`${focus}:`)))
    : []
  const doneJobs = live ? live.jobs.filter((j) => live.byJob[j]?.status === 'done') : []
  const total = live?.jobs.length ?? 0
  const writing = live ? live.jobs.filter((j) => live.byJob[j]?.status === 'writing').length : 0
  const lastDone = doneJobs.length ? doneJobs[doneJobs.length - 1] : null
  const waiting = total - doneJobs.length - writing

  const subline = !live
    ? 'Connecting to the writer…'
    : live.engine === 'ai'
      ? `Streaming live from ${live.model ?? 'the AI model'} · ${doneJobs.length} of ${total} done${writing ? ` · ${writing} writing` : ''}`
      : 'The AI model is off or unavailable, so the template engine is writing everything.'

  return (
    <div className="live" aria-busy="true">
      <Card padding="lg" className="live__header">
        <div className="live__head">
          {live?.engine === 'ai' ? (
            <Sparkles className="live__spark" aria-hidden />
          ) : (
            <Loader2 className="live__spark spin" aria-hidden />
          )}
          <div className="live__titles">
            <h1 className="live__title">Writing your content</h1>
            <p className="live__sub">{subline}</p>
          </div>
          {live?.engine === 'ai' && waiting > 0 && writing <= 1 ? (
            <p className="live__queue">Queued pieces start as soon as the model is free.</p>
          ) : null}
          <span className="live__clock tabular" aria-label={`${seconds} seconds elapsed`}>
            {clock(seconds)}
          </span>
          <Button variant="secondary" size="sm" icon={<Square aria-hidden />} onClick={onStop}>
            Stop
          </Button>
        </div>
        <div
          className="live__bar"
          role="progressbar"
          aria-label="Pieces of content finished"
          aria-valuemin={0}
          aria-valuemax={total || 1}
          aria-valuenow={doneJobs.length}
        >
          <m.span
            className="live__bar-fill"
            animate={{ width: total ? `${(doneJobs.length / total) * 100}%` : '6%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="sr-only" role="status">
          {lastDone && live
            ? `${jobLabel(lastDone, live.variations)} finished${live.byJob[lastDone]?.source === 'template' ? ' from templates' : ''}. ${doneJobs.length} of ${total} done.`
            : ''}
        </p>
      </Card>

      {live ? (
        <ul className="live__grid" aria-label="Content being written">
          {jobs.map((job) => (
            <JobCard key={job} job={job} state={live.byJob[job]} variations={live.variations} />
          ))}
        </ul>
      ) : (
        <div className="live__grid live__grid--placeholder" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="live-job">
              <Skeleton variant="title" />
              <Skeleton />
              <Skeleton width="70%" />
            </div>
          ))}
        </div>
      )}

      <div className="live__tip">
        <Lightbulb className="live__tip-icon" aria-hidden />
        <div className="live__tip-text">
          <p className="live__tip-label">While you wait</p>
          <AnimatePresence mode="wait" initial={false}>
            <m.p
              key={tip}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {tip}
            </m.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
