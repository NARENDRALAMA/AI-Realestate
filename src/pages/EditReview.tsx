import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, History, Loader2, Minimize2, Sparkles, TrendingUp } from 'lucide-react'
import { Card } from '../components/Card'
import { useApp } from '../hooks/useApp'
import type { GeneratedBundle } from '../types'

const fieldLabels: { key: keyof GeneratedBundle; label: string }[] = [
  { key: 'listing', label: 'Listing Description' },
  { key: 'social', label: 'Social Post' },
  { key: 'email', label: 'Email Copy' },
  { key: 'video', label: 'Video Script' },
]

type RefineOp = 'tone' | 'persuasive' | 'shorten'

export function EditReview() {
  const {
    drafts,
    setDrafts,
    versionHistory,
    applyImproveAll,
    applyPersuasiveAll,
    applyShortenAll,
    finalizeEdits,
  } = useApp()
  const navigate = useNavigate()
  const [refining, setRefining] = useState<RefineOp | null>(null)
  const [refineError, setRefineError] = useState<string | null>(null)

  if (!drafts) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1 className="page-title">Nothing to review</h1>
          <p className="page-lead">Generate content first, then refine it here.</p>
        </div>
      </div>
    )
  }

  const handleRefine = async (op: RefineOp, fn: () => Promise<void>) => {
    setRefining(op)
    setRefineError(null)
    try {
      await fn()
    } catch {
      setRefineError('Refinement failed — is the backend running?')
    } finally {
      setRefining(null)
    }
  }

  return (
    <div className="page page--edit">
      <div className="page-header">
        <h1 className="page-title">Edit & review</h1>
        <p className="page-lead">
          Adjust copy before export. Refinements call the backend generator.
        </p>
        <div className="toolbar">
          <button
            type="button"
            className="btn btn--secondary"
            disabled={refining !== null}
            onClick={() => handleRefine('tone', applyImproveAll)}
          >
            {refining === 'tone'
              ? <Loader2 size={18} className="spin" aria-hidden />
              : <Sparkles size={18} aria-hidden />}
            Improve Tone
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={refining !== null}
            onClick={() => handleRefine('persuasive', applyPersuasiveAll)}
          >
            {refining === 'persuasive'
              ? <Loader2 size={18} className="spin" aria-hidden />
              : <TrendingUp size={18} aria-hidden />}
            Make More Persuasive
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={refining !== null}
            onClick={() => handleRefine('shorten', applyShortenAll)}
          >
            {refining === 'shorten'
              ? <Loader2 size={18} className="spin" aria-hidden />
              : <Minimize2 size={18} aria-hidden />}
            Shorten
          </button>
        </div>
        {refineError && (
          <p style={{ color: 'var(--color-error, #ef4444)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {refineError}
          </p>
        )}
      </div>

      <div className="edit-grid">
        <div className="edit-grid__fields">
          {fieldLabels.map(({ key, label }) => (
            <Card key={key}>
              <label className="field">
                <span className="field__label">{label}</span>
                <textarea
                  className="textarea textarea--tall"
                  value={drafts[key]}
                  onChange={(e) =>
                    setDrafts((d) =>
                      d ? { ...d, [key]: e.target.value } : d,
                    )
                  }
                  rows={12}
                />
              </label>
            </Card>
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                finalizeEdits(drafts)
                navigate('/export')
              }}
            >
              <CheckCircle2 size={18} aria-hidden />
              Finalize
            </button>
          </div>
        </div>

        <aside className="history-panel">
          <Card>
            <h3 className="history-panel__title">
              <History size={18} aria-hidden />
              Version history
            </h3>
            <ul className="history-list">
              {versionHistory.length === 0 ? (
                <li className="history-list__empty">No events yet.</li>
              ) : (
                versionHistory.map((v) => (
                  <li key={v.id} className="history-list__item">
                    <span className="history-list__label">{v.label}</span>
                    <span className="history-list__time">{v.at}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
