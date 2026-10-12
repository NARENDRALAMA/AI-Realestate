import { ArrowRight } from 'lucide-react'
import { GuideGrid } from '../components/GuideArticle'
import { LinkButton } from '../components/ui/Button'
import { Reveal } from '../components/motion/Reveal'

export function LandingGuides() {
  return (
    <section id="guides" className="section-block section-block--sand" aria-labelledby="guides-title">
      <div className="site-container">
        <Reveal className="section-head-center">
          <p className="eyebrow">Guides</p>
          <h2 id="guides-title" className="display section-title-xl">
            Learn the craft, not just the tool.
          </h2>
          <p className="lead">
            Short, practical tutorials on writing property details that sell, choosing a tone and
            checking AI copy before it goes live.
          </p>
        </Reveal>
        <Reveal>
          <GuideGrid base="/guides" limit={3} />
        </Reveal>
        <div className="guides-strip__foot">
          <LinkButton to="/guides" variant="secondary" iconAfter={<ArrowRight aria-hidden />}>
            All guides
          </LinkButton>
        </div>
      </div>
    </section>
  )
}
