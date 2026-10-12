import { useNavigate } from 'react-router-dom'
import { ArrowRight, Wand2 } from 'lucide-react'
import { Button, LinkButton } from '../components/ui/Button'
import { Photo } from '../components/media/Media'
import { Reveal } from '../components/motion/Reveal'
import { useApp } from '../hooks/useApp'

export function FinalCta() {
  const { loadSampleProperty } = useApp()
  const navigate = useNavigate()

  return (
    <section className="cta-band" aria-labelledby="cta-title">
      <Photo name="living" sizes="100vw" className="cta-band__photo" alt="" />
      <div className="cta-band__scrim" aria-hidden />
      <Reveal className="site-container cta-band__inner">
        <h2 id="cta-title" className="display display--on-ink cta-band__title">
          Write your next listing in minutes.
        </h2>
        <p className="lead lead--on-ink">
          Start with your own property, or try the built-in sample to see all four channels first.
        </p>
        <div className="cta-band__actions">
          <LinkButton to="/app/property" variant="primary" size="lg" iconAfter={<ArrowRight aria-hidden />}>
            Start writing
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
            Try the sample property
          </Button>
        </div>
      </Reveal>
    </section>
  )
}
