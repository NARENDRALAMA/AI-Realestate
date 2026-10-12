import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock, Lightbulb, X } from 'lucide-react'
import { guideBySlug, guides, type Guide } from '../content/guides'
import { Badge } from './ui/Badge'
import './guides.css'

/** Renders `code` spans written with backticks in guide text. */
function Rich({ text }: { text: string }) {
  const parts = text.split('`')
  return (
    <>
      {parts.map((part, i) => (i % 2 ? <code key={i}>{part}</code> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}

export function GuideCard({ guide, base }: { guide: Guide; base: string }) {
  return (
    <Link to={`${base}/${guide.slug}`} className="guide-card">
      <span className="guide-card__meta">
        <Badge tone="accent">{guide.level}</Badge>
        <span className="guide-card__time">
          <Clock aria-hidden /> {guide.minutes} min read
        </span>
      </span>
      <span className="guide-card__title">{guide.title}</span>
      <span className="guide-card__summary">{guide.summary}</span>
      <span className="guide-card__cta">
        Read the guide <ArrowRight aria-hidden />
      </span>
    </Link>
  )
}

export function GuideGrid({ base, limit }: { base: string; limit?: number }) {
  const list = limit ? guides.slice(0, limit) : guides
  return (
    <ul className="guide-grid">
      {list.map((g) => (
        <li key={g.slug}>
          <GuideCard guide={g} base={base} />
        </li>
      ))}
    </ul>
  )
}

/** A full tutorial: sections with steps, tips and good/bad examples, then related guides. */
export function GuideArticle({ guide, base, footer }: { guide: Guide; base: string; footer?: ReactNode }) {
  const related = (guide.related ?? []).map(guideBySlug).filter((g): g is Guide => !!g)
  return (
    <article className="guide">
      <header className="guide__header">
        <span className="guide-card__meta">
          <Badge tone="accent">{guide.level}</Badge>
          <span className="guide-card__time">
            <Clock aria-hidden /> {guide.minutes} min read
          </span>
        </span>
        <h1 className="guide__title">{guide.title}</h1>
        <p className="guide__summary">{guide.summary}</p>
      </header>

      {guide.sections.map((section) => (
        <section key={section.heading} className="guide__section">
          <h2 className="guide__h2">{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="guide__p">
              <Rich text={p} />
            </p>
          ))}
          {section.steps ? (
            <ol className="guide__steps">
              {section.steps.map((s) => (
                <li key={s}>
                  <Rich text={s} />
                </li>
              ))}
            </ol>
          ) : null}
          {section.example ? (
            <div className="guide__example">
              <p className="guide__example-label">{section.example.label}</p>
              {section.example.bad ? (
                <p className="guide__example-row guide__example-row--bad">
                  <X aria-hidden />
                  <span>
                    <span className="sr-only">Weaker: </span>
                    {section.example.bad}
                  </span>
                </p>
              ) : null}
              <p className="guide__example-row guide__example-row--good">
                <Check aria-hidden />
                <span>
                  <span className="sr-only">Stronger: </span>
                  {section.example.good}
                </span>
              </p>
            </div>
          ) : null}
          {section.tips?.map((t) => (
            <p key={t} className="guide__tip">
              <Lightbulb aria-hidden />
              <span>
                <Rich text={t} />
              </span>
            </p>
          ))}
        </section>
      ))}

      {footer}

      {related.length ? (
        <aside className="guide__related" aria-labelledby="related-title">
          <h2 id="related-title" className="guide__h2">
            Related guides
          </h2>
          <ul className="guide-grid guide-grid--2">
            {related.map((g) => (
              <li key={g.slug}>
                <GuideCard guide={g} base={base} />
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </article>
  )
}
