import { useEffect, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { GuideArticle, GuideGrid } from '../../components/GuideArticle'
import { LinkButton } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { guideBySlug } from '../../content/guides'
import { SiteFooter } from '../../landing/SiteFooter'
import { SiteNav } from '../../landing/SiteNav'
import '../../landing/landing.css'

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="landing" id="top">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav />
      <main id="main" className="site-container guides-page">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function GuidesIndex() {
  useEffect(() => {
    document.title = 'Guides · REM Content Studio'
  }, [])
  return (
    <PublicShell>
      <p className="eyebrow">Guides</p>
      <h1 className="display section-title-xl">Write better listings, faster.</h1>
      <p className="lead guides-page__lead">
        Practical tutorials for agents: writing strong property details, choosing a tone, reviewing
        AI output and publishing across channels.
      </p>
      <GuideGrid base="/guides" />
    </PublicShell>
  )
}

export function GuideDetail() {
  const { slug } = useParams()
  const guide = guideBySlug(slug)
  useEffect(() => {
    document.title = `${guide?.title ?? 'Guide not found'} · REM Content Studio`
  }, [guide])
  return (
    <PublicShell>
      {guide ? (
        <GuideArticle
          guide={guide}
          base="/guides"
          footer={
            <div className="cluster section">
              <LinkButton to="/guides" variant="ghost" icon={<ArrowLeft aria-hidden />}>
                All guides
              </LinkButton>
              <LinkButton to="/app" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
                Launch app
              </LinkButton>
            </div>
          }
        />
      ) : (
        <EmptyState
          headingLevel={1}
          title="Guide not found"
          description="It may have been renamed. Browse all guides instead."
          actions={
            <LinkButton to="/guides" variant="primary">
              All guides
            </LinkButton>
          }
        />
      )}
    </PublicShell>
  )
}
