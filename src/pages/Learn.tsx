import { useParams } from 'react-router-dom'
import { ArrowLeft, Compass, RotateCcw } from 'lucide-react'
import { GuideArticle, GuideGrid } from '../components/GuideArticle'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Button, LinkButton } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { guideBySlug } from '../content/guides'
import { useToast } from '../hooks/useToast'
import { startTour, writeHiddenTips } from '../lib/tips-storage'

export function Learn() {
  const toast = useToast()
  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/app' }, { label: 'Learn' }]} />
      <PageHeader
        title="Learn"
        description="Short, practical tutorials on getting the best copy out of REM Content Studio."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RotateCcw aria-hidden />}
              onClick={() => {
                writeHiddenTips([])
                toast.show('Tips will show on every step again', 'info')
              }}
            >
              Show hidden tips
            </Button>
            <Button variant="primary" icon={<Compass aria-hidden />} onClick={startTour}>
              Take the tour
            </Button>
          </>
        }
      />
      <GuideGrid base="/app/learn" />
    </div>
  )
}

export function LearnGuide() {
  const { slug } = useParams()
  const guide = guideBySlug(slug)
  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/app' },
          { label: 'Learn', to: '/app/learn' },
          { label: guide?.title ?? 'Guide not found' },
        ]}
      />
      {guide ? (
        <GuideArticle
          guide={guide}
          base="/app/learn"
          footer={
            <div className="cluster section">
              <LinkButton to="/app/learn" variant="ghost" icon={<ArrowLeft aria-hidden />}>
                All guides
              </LinkButton>
              <LinkButton to="/app/property" variant="primary">
                Start creating
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
            <LinkButton to="/app/learn" variant="primary">
              All guides
            </LinkButton>
          }
        />
      )}
    </div>
  )
}
