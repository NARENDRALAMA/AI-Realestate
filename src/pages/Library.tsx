import { useMemo, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CalendarDays,
  Eye,
  Layers,
  MapPin,
  Mic2,
  Plus,
  RefreshCw,
  RotateCcw,
  SearchX,
  Trash2,
} from 'lucide-react'
import { m } from 'motion/react'
import { ChannelPanel, ExtraPanel, VersionPicker } from '../components/ChannelPanel'
import { EngineChip } from '../components/EngineBadge'
import { ThumbTile } from '../components/ThumbTile'
import { Alert } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState } from '../components/ui/EmptyState'
import { Input, Select } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { Skeleton, SkeletonText } from '../components/ui/Skeleton'
import { BarList, StatCard } from '../components/ui/StatCard'
import { Tabs } from '../components/ui/Tabs'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { useAsync } from '../hooks/useAsync'
import { useToast } from '../hooks/useToast'
import {
  deleteLibraryItem,
  fetchLibrary,
  fetchLibraryItem,
  fetchStats,
  propertyFromStored,
  type LibraryDetail,
  type LibraryItem,
} from '../lib/api'
import {
  channelLabels,
  CHANNELS,
  contentTypeOptions,
  extraFormatLabel,
  toneLabel,
  toneOptions,
} from '../lib/content-options'
import { engineFromModelUsed, engineLabel } from '../lib/engine'
import { formatServerDate, parseServerDate, pluralize } from '../lib/format'
import { defaultSettings, emptyProperty, type ContentType, type ExtraFormat, type GeneratedBundle, type Tone } from '../types'

const typeName = (t: string) => channelLabels[t as ContentType] ?? t

const engineOptions = [
  { value: 'all', label: 'All engines' },
  { value: 'ai', label: 'AI' },
  { value: 'partial', label: 'Partly AI' },
  { value: 'template', label: 'Template fallback' },
]

const engineOf = (i: LibraryItem) => engineFromModelUsed(i.model_used, i.generation_time_ms)

const dateOptions = [
  { value: 'any', label: 'Any time', days: 0 },
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
]

type DetailState =
  | { status: 'closed' }
  | { status: 'loading'; item: LibraryItem }
  | { status: 'error'; item: LibraryItem; message: string }
  | { status: 'ready'; item: LibraryItem; detail: LibraryDetail }

function topEntry(record: Record<string, number> | undefined) {
  const entries = Object.entries(record ?? {}).sort((a, b) => b[1] - a[1])
  return entries[0] ?? null
}

export function Library() {
  const toast = useToast()
  const library = useAsync(fetchLibrary)
  const stats = useAsync(fetchStats)

  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [tone, setTone] = useState('all')
  const [engine, setEngine] = useState('all')
  const [date, setDate] = useState<{ value: string; cutoff: number }>({ value: 'any', cutoff: 0 })

  const [detail, setDetail] = useState<DetailState>({ status: 'closed' })
  const [detailTab, setDetailTab] = useState<string>('listing')
  const [detailVersion, setDetailVersion] = useState(0)
  const { openResult } = useApp()
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState<LibraryItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const items = useMemo(() => library.data ?? [], [library.data])
  const filtersActive =
    query.trim() !== '' || type !== 'all' || tone !== 'all' || engine !== 'all' || date.value !== 'any'

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (type !== 'all' && i.content_type !== type) return false
      if (tone !== 'all' && i.tone !== tone) return false
      if (engine !== 'all' && engineOf(i).engine !== engine) return false
      if (date.cutoff) {
        const d = parseServerDate(i.created_at)
        if (!d || d.getTime() < date.cutoff) return false
      }
      if (!q) return true
      return [i.title, i.location, i.preview].some((f) => f.toLowerCase().includes(q))
    })
  }, [items, query, type, tone, engine, date])

  // model_used isn't in /api/stats, so the engine breakdown is counted from the list.
  const byEngine = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of items) {
      const label = engineLabel(engineOf(i))
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return [...counts].map(([label, value]) => ({ label, value }))
  }, [items])

  const clearFilters = () => {
    setQuery('')
    setType('all')
    setTone('all')
    setEngine('all')
    setDate({ value: 'any', cutoff: 0 })
  }

  const openDetail = async (item: LibraryItem) => {
    setDetail({ status: 'loading', item })
    setDetailTab((CHANNELS as string[]).includes(item.content_type) ? (item.content_type as ContentType) : 'listing')
    setDetailVersion(0)
    try {
      const data = await fetchLibraryItem(item.id)
      setDetail((d) => (d.status !== 'closed' && d.item.id === item.id ? { status: 'ready', item, detail: data } : d))
    } catch (err) {
      setDetail((d) =>
        d.status !== 'closed' && d.item.id === item.id
          ? { status: 'error', item, message: err instanceof Error ? err.message : "Couldn't open this item." }
          : d,
      )
    }
  }

  const askDelete = (item: LibraryItem) => {
    setDetail({ status: 'closed' })
    setDeleteError(null)
    setToDelete(item)
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteLibraryItem(toDelete.id)
      library.setData((prev) => (prev ?? []).filter((i) => i.id !== toDelete.id))
      stats.reload()
      toast.show(`Deleted “${toDelete.title}”`)
      setToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete this item.")
    } finally {
      setDeleting(false)
    }
  }

  const s = stats.data
  const topType = topEntry(s?.by_type)
  const topTone = topEntry(s?.by_tone)
  const statsLoading = stats.status === 'loading' && !s

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/app' }, { label: 'Library' }]} />
      <PageHeader
        title="Library"
        description="Every piece of content you generate is saved here automatically."
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden />}
              loading={library.status === 'loading' && !!library.data}
              onClick={() => {
                library.reload()
                stats.reload()
              }}
            >
              Refresh
            </Button>
            <LinkButton to="/app/property" variant="primary" icon={<Plus aria-hidden />}>
              Create content
            </LinkButton>
          </>
        }
      />

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="stats-title" className="stack section">
        <h2 id="stats-title" className="sr-only">
          Summary
        </h2>
        {stats.status === 'error' ? (
          <Alert
            tone="danger"
            title="Couldn't load your stats"
            actions={
              <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden />} onClick={stats.reload}>
                Try again
              </Button>
            }
          >
            {stats.error}
          </Alert>
        ) : null}
        <div className="stat-grid" aria-busy={statsLoading || undefined}>
          <StatCard label="Total generated" icon={<Layers />} value={s?.total ?? 0} loading={statsLoading} />
          <StatCard label="This week" icon={<CalendarDays />} value={s?.this_week ?? 0} hint="Last 7 days" loading={statsLoading} />
          <StatCard
            label="Top content type"
            icon={<BarChart3 />}
            value={topType ? typeName(topType[0]) : '—'}
            hint={topType ? pluralize(topType[1], 'piece') : 'No content yet'}
            loading={statsLoading}
          />
          <StatCard
            label="Top tone"
            icon={<Mic2 />}
            value={topTone ? toneLabel(topTone[0]) : '—'}
            hint={topTone ? pluralize(topTone[1], 'piece') : 'No content yet'}
            loading={statsLoading}
          />
        </div>
        {s && s.total > 0 ? (
          <div className="grid-3">
            <Card as="section" aria-labelledby="by-type-title">
              <CardHeader level={3} titleId="by-type-title" title="By content type" />
              <BarList items={Object.entries(s.by_type).map(([k, v]) => ({ label: typeName(k), value: v }))} />
            </Card>
            <Card as="section" aria-labelledby="by-tone-title">
              <CardHeader level={3} titleId="by-tone-title" title="By tone" />
              <BarList items={Object.entries(s.by_tone).map(([k, v]) => ({ label: toneLabel(k), value: v }))} />
            </Card>
            <Card as="section" aria-labelledby="by-engine-title">
              <CardHeader level={3} titleId="by-engine-title" title="By engine" />
              <BarList items={byEngine} emptyText="Loading…" />
            </Card>
          </div>
        ) : null}
      </section>

      {/* ── List ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="list-title" className="stack section">
        <h2 id="list-title" className="section-title">
          Saved content
        </h2>

        <Card className="filter-bar">
          <Input
            label="Search"
            type="search"
            placeholder="Title, suburb or text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Select
            label="Content type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[{ value: 'all', label: 'All types' }, ...contentTypeOptions.map((o) => ({ value: o.value, label: channelLabels[o.value] }))]}
          />
          <Select
            label="Tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            options={[{ value: 'all', label: 'All tones' }, ...toneOptions]}
          />
          <Select
            label="Engine"
            value={engine}
            onChange={(e) => setEngine(e.target.value)}
            options={engineOptions}
          />
          <Select
            label="Date"
            value={date.value}
            onChange={(e) => {
              const days = dateOptions.find((o) => o.value === e.target.value)?.days ?? 0
              setDate({ value: e.target.value, cutoff: days ? Date.now() - days * 86_400_000 : 0 })
            }}
            options={dateOptions}
          />
        </Card>

        {library.status === 'success' || library.data ? (
          <div className="cluster cluster--between">
            <p className="text-muted text-sm" role="status">
              {filtersActive
                ? `Showing ${filtered.length} of ${pluralize(items.length, 'item')}`
                : pluralize(items.length, 'item')}
            </p>
            {filtersActive ? (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : null}

        {library.status === 'error' ? (
          <Card padding="lg">
            <EmptyState
              tone="danger"
              icon={<AlertCircle />}
              title="Couldn't load your library"
              description={library.error}
              actions={
                <Button variant="primary" icon={<RotateCcw aria-hidden />} onClick={library.reload}>
                  Try again
                </Button>
              }
            />
          </Card>
        ) : library.status === 'loading' && !library.data ? (
          <Card padding="none" aria-busy="true">
            <span className="sr-only">Loading your library…</span>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="table-skeleton-row">
                <Skeleton width="40%" />
                <Skeleton width="70%" />
              </div>
            ))}
          </Card>
        ) : items.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<BookOpen />}
              title="Your library is empty"
              description="Generate your first piece of content and it will be saved here automatically."
              actions={
                <LinkButton to="/app/property" variant="primary" icon={<Plus aria-hidden />}>
                  Create content
                </LinkButton>
              }
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="lg">
            <EmptyState
              icon={<SearchX />}
              title="No matches"
              description="Nothing matches your search and filters. Try fewer words or a wider date range."
              actions={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <Card padding="none" className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Focus</th>
                  <th scope="col">Tone</th>
                  <th scope="col">Engine</th>
                  <th scope="col">Created</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <m.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.03, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <td data-label="Property" className="data-table__cell-primary">
                      <div className="data-table__with-thumb">
                        <ThumbTile title={item.title} type={item.content_type} />
                        <div className="data-table__primary">
                          <span className="data-table__title">{item.title}</span>
                          <span className="data-table__sub">
                            <MapPin aria-hidden />
                            {item.location}
                          </span>
                          <span className="data-table__preview">{item.preview}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Focus">
                      <Badge tone="primary">{typeName(item.content_type)}</Badge>
                    </td>
                    <td data-label="Tone">{toneLabel(item.tone)}</td>
                    <td data-label="Engine">
                      <EngineChip meta={engineOf(item)} />
                    </td>
                    <td data-label="Created" className="data-table__date">
                      {formatServerDate(item.created_at)}
                    </td>
                    <td className="data-table__actions">
                      <Button size="sm" variant="secondary" icon={<Eye aria-hidden />} onClick={() => void openDetail(item)}>
                        View<span className="sr-only"> {item.title}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 aria-hidden />}
                        aria-label={`Delete ${item.title}`}
                        onClick={() => askDelete(item)}
                      />
                    </td>
                  </m.tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* ── Detail ────────────────────────────────────────────────────── */}
      <Dialog
        open={detail.status !== 'closed'}
        onClose={() => setDetail({ status: 'closed' })}
        placement="right"
        title={detail.status !== 'closed' ? detail.item.title : ''}
        description={
          detail.status !== 'closed'
            ? `${detail.item.location} · ${formatServerDate(detail.item.created_at)}`
            : undefined
        }
        footer={
          detail.status !== 'closed' ? (
            <>
              <Button
                variant="ghost"
                icon={<Trash2 aria-hidden />}
                onClick={() => askDelete(detail.item)}
              >
                Delete
              </Button>
              {detail.status === 'ready' ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    const d = detail.detail
                    // Restore the exact facts and settings it was generated from, so
                    // regenerating reuses them instead of a title and suburb only.
                    openResult(
                      d.property ? propertyFromStored(d.property) : { ...emptyProperty(), title: d.title, location: d.location },
                      {
                        ...defaultSettings(),
                        tone: d.tone as Tone,
                        contentType: d.content_type as ContentType,
                        length: d.length ?? 'medium',
                        platform: d.platform ?? 'instagram',
                        keywords: d.keywords ?? '',
                        extraFormats: Object.keys(d.extras ?? {}) as ExtraFormat[],
                      },
                      {
                        id: d.id,
                        bundle: d.bundle,
                        model_used: d.model_used,
                        generation_time_ms: d.generation_time_ms,
                        channel_sources: d.channel_sources,
                        extras: d.extras ?? {},
                        variants: d.variants ?? {},
                      },
                    )
                    setDetail({ status: 'closed' })
                    navigate('/app/generated')
                  }}
                >
                  Open in editor
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => setDetail({ status: 'closed' })}>
                Close
              </Button>
            </>
          ) : null
        }
      >
        {detail.status === 'loading' ? (
          <div aria-busy="true" className="stack">
            <span className="sr-only">Loading content…</span>
            <Skeleton variant="title" />
            <SkeletonText lines={6} />
          </div>
        ) : detail.status === 'error' ? (
          <Alert
            tone="danger"
            title="Couldn't open this item"
            actions={
              <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden />} onClick={() => void openDetail(detail.item)}>
                Try again
              </Button>
            }
          >
            {detail.message}
          </Alert>
        ) : detail.status === 'ready' ? (
          <div className="stack">
            <div className="cluster">
              <Badge tone="primary">Focus: {typeName(detail.detail.content_type)}</Badge>
              <Badge>{toneLabel(detail.detail.tone)} tone</Badge>
              <EngineChip meta={engineFromModelUsed(detail.detail.model_used, detail.detail.generation_time_ms)} />
            </div>
            <Tabs
              label="Saved channels"
              value={detailTab}
              onChange={(t) => {
                setDetailTab(t)
                setDetailVersion(0)
              }}
              items={[
                ...CHANNELS.map((ch) => ({ id: ch as string, label: channelLabels[ch] })),
                ...(Object.keys(detail.detail.extras ?? {}) as ExtraFormat[]).map((fmt) => ({
                  id: `extra:${fmt}`,
                  label: extraFormatLabel[fmt],
                })),
              ]}
            >
              {detailTab.startsWith('extra:') ? (
                <ExtraPanel
                  format={detailTab.slice(6) as ExtraFormat}
                  text={detail.detail.extras?.[detailTab.slice(6) as ExtraFormat] ?? ''}
                />
              ) : (
                (() => {
                  const ch = detailTab as keyof GeneratedBundle
                  const all = [detail.detail.bundle[ch], ...(detail.detail.variants?.[ch] ?? [])]
                  return (
                    <ChannelPanel
                      channel={ch}
                      text={all[detailVersion] ?? all[0]}
                      actions={
                        <VersionPicker count={all.length} selected={detailVersion} onSelect={setDetailVersion} />
                      }
                    />
                  )
                })()
              )}
            </Tabs>
          </div>
        ) : null}
      </Dialog>

      {/* ── Delete confirmation ───────────────────────────────────────── */}
      <Dialog
        open={toDelete !== null}
        onClose={() => !deleting && setToDelete(null)}
        title="Delete this content?"
        description={
          toDelete ? `“${toDelete.title}” will be removed from your library. This can't be undone.` : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={deleting} data-autofocus>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 aria-hidden />}
              loading={deleting}
              loadingText="Deleting…"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </>
        }
      >
        {deleteError ? (
          <Alert tone="danger" title="Delete failed">
            {deleteError}
          </Alert>
        ) : null}
      </Dialog>
    </div>
  )
}
