import { useEffect, useState } from 'react'
import { AlertCircle, BookOpen, Loader2, MapPin, Trash2, X } from 'lucide-react'
import { Card } from '../components/Card'
import { deleteLibraryItem, fetchLibrary, fetchLibraryItem, fetchStats } from '../lib/api'
import type { LibraryDetail, LibraryItem, StatsResponse } from '../lib/api'

export function Library() {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<LibraryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [stats, setStats] = useState<StatsResponse | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, statsData] = await Promise.all([fetchLibrary(), fetchStats()])
      setItems(data)
      setStats(statsData)
    } catch {
      setError('Could not load library — is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleView = async (id: number) => {
    setDetailLoading(true)
    try {
      const data = await fetchLibraryItem(id)
      setDetail(data)
    } catch {
      setError('Could not load item')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteLibraryItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
      if (detail?.id === id) setDetail(null)
      if (stats) {
        setStats((s) => s ? { ...s, total: s.total - 1 } : s)
      }
    } catch {
      setError('Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Output library</h1>
        <p className="page-lead">
          All generated content packs, saved automatically on each generation run.
        </p>
      </div>

      {/* Stats dashboard */}
      {loading && !error && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 80,
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      )}

      {stats && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <Card>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Total generated</div>
            </div>
          </Card>
          <Card>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{stats.this_week}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>This week</div>
            </div>
          </Card>
          {Object.entries(stats.by_type).map(([type, count]) => (
            <Card key={type}>
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', textTransform: 'capitalize' }}>{type}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Recent activity */}
      {stats && stats.recent.length > 0 && !loading && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recent activity</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.recent.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'center',
                  padding: '0.625rem 0.875rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ fontWeight: 600, flex: '1 1 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.content_type}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.tone}</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.created_at}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="empty-state" style={{ paddingBottom: '1.5rem' }}>
          <AlertCircle size={32} strokeWidth={1.5} aria-hidden />
          <p className="page-lead">{error}</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <BookOpen size={40} strokeWidth={1.25} aria-hidden />
          <h2 className="page-title" style={{ fontSize: '1.25rem' }}>Library is empty</h2>
          <p className="page-lead">
            Generate content from the Settings page — each run is saved here automatically.
          </p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="library-list">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="library-item">
                <div className="library-item__body">
                  <p className="library-item__title">{item.title}</p>
                  <p className="library-item__meta">
                    <span>
                      <MapPin size={12} aria-hidden style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {item.location}
                    </span>
                    <span>·</span>
                    <span style={{ textTransform: 'capitalize' }}>{item.tone}</span>
                    <span>·</span>
                    <span style={{ textTransform: 'capitalize' }}>{item.content_type}</span>
                    <span>·</span>
                    <span>{item.created_at}</span>
                  </p>
                  <p className="library-item__preview">{item.preview}</p>
                </div>
                <div className="library-item__actions">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleView(item.id)}
                    disabled={detailLoading}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    aria-label="Delete"
                  >
                    {deletingId === item.id
                      ? <Loader2 size={15} className="spin" aria-hidden />
                      : <Trash2 size={15} aria-hidden />}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            zIndex: 50,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              width: 'min(560px, 100%)',
              height: '100%',
              overflowY: 'auto',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{detail.title}</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {detail.location} · {detail.tone} · {detail.created_at}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {(['listing', 'social', 'email', 'video'] as const).map((key) => {
              const labels = {
                listing: 'Listing Description',
                social: 'Social Post',
                email: 'Email Copy',
                video: 'Video Script',
              }
              return (
                <div key={key} className="library-detail__section">
                  <p className="library-detail__heading">{labels[key]}</p>
                  <pre className="library-detail__body">{detail.bundle[key]}</pre>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
