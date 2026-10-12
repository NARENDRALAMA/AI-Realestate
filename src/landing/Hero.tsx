import { m } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { LinkButton } from '../components/ui/Button'
import { Photo } from '../components/media/Media'
import { useHydrated } from '../hooks/useHydrated'
import { ProductPreview } from './ProductPreview'

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const hydrated = useHydrated()
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="site-container hero__grid">
        <div className="hero__copy">
          <p className="eyebrow">For real estate agents and marketing teams</p>
          <h1 id="hero-title" className="display hero__title">
            One property. <em>Every channel</em> it needs.
          </h1>
          <p className="lead hero__lead">
            Enter a property's details once. REM Content Studio writes the listing description,
            social post, email and video script in the tone you choose — ready for you to review,
            refine and export.
          </p>
          <div className="hero__actions">
            <LinkButton to="/app" variant="primary" size="lg" iconAfter={<ArrowRight aria-hidden />}>
              Launch app
            </LinkButton>
            <a className="btn btn--secondary btn--lg" href="#channels">
              See sample output
            </a>
          </div>
          <ul className="hero__facts" aria-label="At a glance">
            <li>
              <strong>4</strong> channels
            </li>
            <li>
              <strong>6</strong> tones
            </li>
            <li>
              <strong>PDF, Word &amp; TXT</strong> export
            </li>
          </ul>
        </div>

        <div className="hero__visual">
          <Photo
            name="hero"
            priority
            sizes="(min-width: 64rem) 55vw, 100vw"
            className="hero__photo"
          />
          <m.div
            className="hero__preview"
            initial={hydrated ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
          >
            <ProductPreview />
          </m.div>
        </div>
      </div>
    </section>
  )
}
