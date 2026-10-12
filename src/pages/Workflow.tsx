import { ArrowRight, Download, FileText, Mail, Share2, Sliders, Sparkles, Video, House } from 'lucide-react'
import { LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const steps = [
  {
    icon: House,
    title: 'Property details',
    desc: 'Enter the listing title and location, plus any specs, features, amenities and agent notes. You can add a photo too.',
    to: '/app/property',
    cta: 'Enter details',
  },
  {
    icon: Sliders,
    title: 'Content settings',
    desc: 'Choose a main focus channel, one of six tones, a length and optional keywords. You see a summary before generating.',
    to: '/app/settings',
    cta: 'Choose settings',
  },
  {
    icon: Sparkles,
    title: 'Generate',
    desc: 'All four channels are written in one pass. Each generation is saved to your library automatically.',
    to: '/app/generated',
    cta: 'View results',
  },
  {
    icon: Download,
    title: 'Review & export',
    desc: 'Edit the copy, apply quick refinements per channel or to all, then copy it or download PDF, Word or plain text.',
    to: '/app/edit',
    cta: 'Review content',
  },
]

const channels = [
  { icon: FileText, name: 'Listing', desc: 'Portal and website description.' },
  { icon: Share2, name: 'Social post', desc: 'Short post with hashtags.' },
  { icon: Mail, name: 'Email', desc: 'Subject line and body for your database.' },
  { icon: Video, name: 'Video script', desc: 'Timed script for a walk-through.' },
]

export function Workflow() {
  return (
    <div className="page page--narrow">
      <PageHeader
        title="How it works"
        description="Four steps from property facts to publish-ready copy."
      />

      <ol className="timeline-steps">
        {steps.map(({ icon: Icon, title, desc, to, cta }, i) => (
          <li key={title} className="timeline-steps__item">
            <span className="timeline-steps__num" aria-hidden>
              {i + 1}
            </span>
            <Card className="timeline-steps__card">
              <CardHeader level={2} icon={<Icon />} title={title} description={desc} />
              <LinkButton to={to} variant="ghost" size="sm" iconAfter={<ArrowRight aria-hidden />}>
                {cta}
              </LinkButton>
            </Card>
          </li>
        ))}
      </ol>

      <section className="section" aria-labelledby="channels-title">
        <h2 id="channels-title" className="section-title section-head">
          What each generation includes
        </h2>
        <ul className="feature-grid feature-grid--2">
          {channels.map(({ icon: Icon, name, desc }) => (
            <li key={name} className="feature">
              <Icon className="feature__icon" aria-hidden />
              <h3 className="feature__title">{name}</h3>
              <p className="feature__desc">{desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
