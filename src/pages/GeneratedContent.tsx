import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Building2,
  Copy,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Card } from '../components/Card'
import { useApp } from '../hooks/useApp'
import { copyText } from '../lib/copy'
import type { ContentType, GeneratedBundle } from '../types'

const labels: Record<keyof GeneratedBundle, string> = {
  listing: 'Listing Description',
  social: 'Social Post',
  email: 'Email Copy',
  video: 'Video Script',
}

const typeLabel: Record<ContentType, string> = {
  listing: 'Listing Description',
  social: 'Social Media Post',
  email: 'Email',
  video: 'Video Script',
}

export function GeneratedContent() {
  const {
    property,
    settings,
    generated,
    drafts,
    isGenerating,
    generationError,
    runGeneration,
  } = useApp()
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)

  const bundle = drafts ?? generated
  const primary = settings.contentType

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyText(text)
    showToast(ok ? `Copied ${label}` : 'Copy failed')
  }

  if (isGenerating) {
    return (
      <div className="page">
        <div className="empty-state">
          <Loader2 size={40} strokeWidth={1.25} className="spin" aria-hidden />
          <h1 className="page-title">Generating content…</h1>
          <p className="page-lead">Building all four channels from your property data.</p>
        </div>
      </div>
    )
  }

  if (generationError) {
    return (
      <div className="page">
        <div className="empty-state">
          <AlertCircle size={40} strokeWidth={1.25} aria-hidden />
          <h1 className="page-title">Generation failed</h1>
          <p className="page-lead">{generationError}</p>
          <div className="empty-state__actions">
            <Link to="/settings" className="btn btn--secondary">
              Back to settings
            </Link>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => runGeneration()}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="page">
        <div className="empty-state">
          <Sparkles size={40} strokeWidth={1.25} aria-hidden />
          <h1 className="page-title">No generated content yet</h1>
          <p className="page-lead">
            Add a property, choose settings, and run generation to see channel outputs
            here.
          </p>
          <div className="empty-state__actions">
            <Link to="/property" className="btn btn--secondary">
              Property input
            </Link>
            <Link to="/settings" className="btn btn--primary">
              Content settings
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page page--split">
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <div className="page--split__main">
        <div className="page-header">
          <h1 className="page-title">Generated content</h1>
          <p className="page-lead">
            Outputs use the <strong>{settings.tone}</strong> tone at{' '}
            <strong>{settings.length}</strong> length. Primary focus:{' '}
            <strong>{typeLabel[primary]}</strong>.
          </p>
          <div className="page-header__row">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                runGeneration()
                showToast('Regenerating…')
              }}
              disabled={isGenerating}
            >
              <RefreshCw size={18} aria-hidden />
              Regenerate
            </button>
            <Link to="/edit" className="btn btn--primary">
              <Pencil size={18} aria-hidden />
              Edit
            </Link>
          </div>
        </div>

        {(Object.keys(bundle) as (keyof GeneratedBundle)[]).map((key) => (
          <Card key={key} className={key === primary ? 'card--accent' : ''}>
            <div className="output-block">
              <div className="output-block__head">
                <h2 className="output-block__title">{labels[key]}</h2>
                {key === primary ? (
                  <span className="badge badge--primary">Primary focus</span>
                ) : null}
              </div>
              <pre className="output-block__body">{bundle[key]}</pre>
              <div className="output-block__actions">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => handleCopy(bundle[key], labels[key])}
                >
                  <Copy size={16} aria-hidden />
                  Copy
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => navigate('/edit')}
                >
                  <Pencil size={16} aria-hidden />
                  Edit
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <aside className="side-panel" aria-label="Property summary">
        <Card>
          <h3 className="side-panel__title">
            <Building2 size={18} aria-hidden />
            Property summary
          </h3>
          <ul className="summary-list">
            <li>
              <strong>Title</strong>
              <span>{property.title || '—'}</span>
            </li>
            <li>
              <strong>Price</strong>
              <span>{property.price || '—'}</span>
            </li>
            <li>
              <strong>Location</strong>
              <span className="summary-list__inline">
                <MapPin size={14} aria-hidden />
                {property.location || '—'}
              </span>
            </li>
            <li>
              <strong>Specs</strong>
              <span>
                {property.bedrooms || '—'} bed · {property.bathrooms || '—'} bath ·{' '}
                {property.parking || '—'} parking
              </span>
            </li>
            <li>
              <strong>Sizes</strong>
              <span>
                Land {property.landSize || '—'}, interior {property.interiorSize || '—'}
              </span>
            </li>
          </ul>
        </Card>
      </aside>
    </div>
  )
}
