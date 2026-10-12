import { useEffect, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Check, FileText, Loader2, Mail, Share2, Video, type LucideIcon } from 'lucide-react'
import { sampleEngine, sampleOutputs } from '../data/sample-outputs'
import { engineFromModelUsed, engineLabel } from '../lib/engine'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { channelLabels, CHANNELS } from '../lib/content-options'
import type { GeneratedBundle } from '../types'

const icons: Record<keyof GeneratedBundle, LucideIcon> = {
  listing: FileText,
  social: Share2,
  email: Mail,
  video: Video,
}

const shortName: Record<keyof GeneratedBundle, string> = {
  listing: 'Listing',
  social: 'Social',
  email: 'Email',
  video: 'Video',
}

const sample = sampleOutputs.formal

/** First meaningful lines of a sample, without the email subject prefix. */
const snippet = (text: string) =>
  text
    .replace(/^Subject: .*\n+/, '')
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, 3)
    .join(' ')
    .slice(0, 150)
    .trimEnd() + '…'

/**
 * Illustrative hero animation: the property's facts turn into four channels, then the
 * card cycles through real sample output for each channel.
 */
export function ProductPreview() {
  const reduce = usePrefersReducedMotion()
  const [ready, setReady] = useState(0)
  const [active, setActive] = useState(0)
  const done = reduce ? CHANNELS.length : ready

  useEffect(() => {
    if (reduce) return
    if (ready < CHANNELS.length) {
      const t = window.setTimeout(() => setReady((r) => r + 1), ready === 0 ? 900 : 550)
      return () => window.clearTimeout(t)
    }
    const t = window.setInterval(() => setActive((a) => (a + 1) % CHANNELS.length), 3200)
    return () => window.clearInterval(t)
  }, [ready, reduce])

  const current = CHANNELS[active]

  return (
    <div className="preview" aria-label="Illustration: one property becoming four pieces of copy" role="img">
      <div className="preview__head">
        <p className="preview__eyebrow">Property</p>
        <p className="preview__title">Sunlit 3-Bed Terrace with City Views</p>
        <p className="preview__meta">Richmond, VIC · 3 bed · 2 bath · 2 car · $1,250,000</p>
      </div>

      <ul className="preview__channels">
        {CHANNELS.map((ch, i) => {
          const Icon = icons[ch]
          const isReady = i < done
          const isActive = isReady && done === CHANNELS.length && ch === current
          return (
            <li key={ch} className={`preview__channel ${isActive ? 'preview__channel--active' : ''}`.trim()}>
              <Icon className="preview__channel-icon" />
              <span className="preview__channel-name">{shortName[ch]}</span>
              <span className={`preview__status ${isReady ? 'preview__status--ready' : ''}`.trim()}>
                {isReady ? <Check /> : <Loader2 className="spin" />}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="preview__output">
        <AnimatePresence mode="wait" initial={false}>
          {done === CHANNELS.length ? (
            <m.p
              key={current}
              className="preview__text"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="preview__text-label">{channelLabels[current]}</span>
              {snippet(sample[current])}
            </m.p>
          ) : (
            <m.span key="skeleton" className="preview__skeleton" exit={{ opacity: 0 }}>
              <span />
              <span />
              <span />
            </m.span>
          )}
        </AnimatePresence>
      </div>
      <p className="preview__foot">
        Sample output · {engineLabel(engineFromModelUsed(sampleEngine.formal, 0))} · formal tone
      </p>
    </div>
  )
}
