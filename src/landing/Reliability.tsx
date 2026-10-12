import { Eye, LifeBuoy, ShieldCheck, Tags, type LucideIcon } from 'lucide-react'
import { Photo } from '../components/media/Media'
import { Reveal, Stagger, StaggerItem } from '../components/motion/Reveal'

const points: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Grounded prompts',
    body: 'The AI model is given only the facts you enter and told never to invent bedrooms, prices, sizes, features or locations. If a detail is missing, it’s left out — not guessed.',
  },
  {
    icon: LifeBuoy,
    title: 'Automatic template fallback',
    body: 'All four channels are written at the same time. If the model is slow or unavailable, that channel is built from proven templates instead, so you always get a complete set.',
  },
  {
    icon: Tags,
    title: 'Always labelled',
    body: 'Every result shows whether it was written by AI, partly by AI, or by templates — with the generation time — in the app and in your library.',
  },
  {
    icon: Eye,
    title: 'You approve everything',
    body: 'AI can still make mistakes, and template copy can include general lines such as being close to schools. Nothing is published from the app: you review, edit and export.',
  },
]

export function Reliability() {
  return (
    <section id="reliability" className="section-block section-block--ink" aria-labelledby="reliability-title">
      <div className="site-container reliability">
        <div className="reliability__intro">
          <Reveal>
            <p className="eyebrow eyebrow--on-ink">Reliability</p>
            <h2 id="reliability-title" className="display display--on-ink section-title-xl">
              Built to be checked, not trusted blindly.
            </h2>
            <p className="lead lead--on-ink">
              Listings carry legal and reputational weight. Here is exactly how the copy is made, so
              you know what to review before it goes out.
            </p>
          </Reveal>
          <Reveal className="reliability__photo-wrap">
            <Photo name="aerial" sizes="(min-width: 64rem) 40vw, 100vw" className="reliability__photo" />
          </Reveal>
        </div>

        <Stagger as="ul" className="reliability__list">
          {points.map(({ icon: Icon, title, body }) => (
            <StaggerItem as="li" key={title} className="reliability__item">
              <Icon className="reliability__icon" aria-hidden />
              <h3 className="reliability__title">{title}</h3>
              <p className="reliability__body">{body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
