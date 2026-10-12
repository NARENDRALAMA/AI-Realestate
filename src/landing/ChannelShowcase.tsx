import { useState } from 'react'
import { ChannelCounts } from '../components/ChannelPanel'
import { BrowserFrame } from '../components/media/Media'
import { Reveal } from '../components/motion/Reveal'
import { Tabs } from '../components/ui/Tabs'
import { sampleOutputs } from '../data/sample-outputs'
import { channelLabels, CHANNELS } from '../lib/content-options'
import type { GeneratedBundle } from '../types'
import { SampleLabel } from './SampleLabel'

const blurbs: Record<keyof GeneratedBundle, string> = {
  listing: 'A portal-ready description: the setting, specs, standout features, agent notes and a call to action.',
  social: 'A post with the key facts, price and hashtags for Instagram or Facebook.',
  email: 'A subject line and body for your buyer database, written to prompt a viewing.',
  video: 'A scene-by-scene walk-through script you can hand to a videographer or read to camera.',
}

export function ChannelShowcase() {
  const [tab, setTab] = useState<keyof GeneratedBundle>('listing')
  const text = sampleOutputs.formal[tab]

  return (
    <section id="channels" className="section-block section-block--sand" aria-labelledby="channels-title">
      <div className="site-container">
        <Reveal className="section-head-center">
          <p className="eyebrow">Channels</p>
          <h2 id="channels-title" className="display section-title-xl">
            Four channels, written from the same facts.
          </h2>
          <p className="lead">
            Every run produces all four, written live before your eyes. Add up to three versions of each,
            plus headline options, a Facebook ad, an SMS, an open-home flyer and SEO metadata.
          </p>
        </Reveal>

        <Reveal className="showcase">
          <Tabs
            label="Sample channels"
            value={tab}
            onChange={setTab}
            items={CHANNELS.map((ch) => ({ id: ch, label: channelLabels[ch] }))}
          >
            <div className="showcase__grid">
              <div className="showcase__sample">
                <div className="showcase__sample-head">
                  <SampleLabel tone="formal" />
                  <ChannelCounts channel={tab} text={text} />
                </div>
                <p className="showcase__blurb">{blurbs[tab]}</p>
                <pre className="prose-output showcase__text">{text}</pre>
              </div>
              <BrowserFrame
                screen={tab}
                sizes="(min-width: 64rem) 560px, 100vw"
                caption={`The ${channelLabels[tab].toLowerCase()} tab in the app`}
              />
            </div>
          </Tabs>
        </Reveal>
      </div>
    </section>
  )
}
