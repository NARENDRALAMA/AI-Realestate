import { useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Photo } from '../components/media/Media'
import { Reveal } from '../components/motion/Reveal'
import { SegmentedToggle } from '../components/ui/SegmentedToggle'
import { sampleOutputs } from '../data/sample-outputs'
import { toneOptions } from '../lib/content-options'
import type { Tone } from '../types'
import { SampleLabel } from './SampleLabel'

/** The listing's opening paragraph — where tone is most audible. */
const opening = (listing: string) => listing.split(/\n\s*\n/)[0]

export function ToneShowcase() {
  const [tone, setTone] = useState<Tone>('formal')
  const option = toneOptions.find((t) => t.value === tone)!
  const bundle = sampleOutputs[tone]

  return (
    <section id="tones" className="section-block" aria-labelledby="tones-title">
      <div className="site-container tones">
        <div className="tones__main">
          <Reveal>
            <p className="eyebrow">Tones</p>
            <h2 id="tones-title" className="display section-title-xl">
              Six tones. The same facts.
            </h2>
            <p className="lead">
              Switch tones to hear the same property in a different voice. The details come from
              what you entered — only the style changes.
            </p>
          </Reveal>

          <Reveal className="tones__toggle">
            <SegmentedToggle
              label="Tone"
              value={tone}
              onChange={setTone}
              options={toneOptions.map((t) => ({ value: t.value, label: t.label }))}
            />
          </Reveal>

          <div className="tones__sample" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={tone}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="tones__sample-head">
                  <SampleLabel tone={tone} />
                  <span className="tones__desc">{option.description}</span>
                </div>
                <p className="tones__label">Listing — opening line</p>
                <blockquote className="tones__quote">{opening(bundle.listing)}</blockquote>
                <p className="tones__label">Social post</p>
                <pre className="prose-output tones__social">{bundle.social}</pre>
              </m.div>
            </AnimatePresence>
          </div>
        </div>

        <Reveal className="tones__photo-wrap">
          <Photo name="kitchen2" sizes="(min-width: 64rem) 34vw, 100vw" className="tones__photo" />
        </Reveal>
      </div>
    </section>
  )
}
