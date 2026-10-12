import { Photo } from '../components/media/Media'
import { Reveal, Stagger, StaggerItem } from '../components/motion/Reveal'

const steps = [
  {
    title: 'Enter the property',
    body: 'Title, location, specs, features and agent notes in one structured form. Add a photo if you like.',
  },
  {
    title: 'Choose the focus and tone',
    body: 'Pick the channel that matters most, one of six tones, a length and any keywords to include.',
  },
  {
    title: 'Generate',
    body: 'The listing, social post, email and video script are written together and saved to your library.',
  },
  {
    title: 'Review and export',
    body: 'Edit anything, refine with one click, then copy it or download a PDF, Word or plain-text file.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="section-block" aria-labelledby="how-title">
      <div className="site-container how">
        <div className="how__intro">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 id="how-title" className="display section-title-xl">
              From property facts to finished copy in four steps.
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="how__photo-wrap">
            <Photo name="keys" sizes="(min-width: 64rem) 40vw, 100vw" className="how__photo" />
          </Reveal>
        </div>

        <Stagger as="ol" className="how__steps">
          {steps.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="how__step">
              <span className="how__num" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className="how__step-title">{s.title}</h3>
                <p className="how__step-body">{s.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
