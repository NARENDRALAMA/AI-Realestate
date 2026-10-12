import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Layers,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  Wand2,
} from 'lucide-react'
import { EngineChip } from '../components/EngineBadge'
import { StepTips } from '../components/StepTips'
import { Alert } from '../components/ui/Alert'
import { Breadcrumbs } from '../components/ui/Breadcrumbs'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { Dialog } from '../components/ui/Dialog'
import { Input, Select, Textarea } from '../components/ui/Field'
import { PageHeader } from '../components/ui/PageHeader'
import { sampleProperty } from '../data/sampleProperty'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { generateContentStream, type StreamResult } from '../lib/api'
import { contentTypeOptions, lengthOptions, toneOptions } from '../lib/content-options'
import { CSV_COLUMNS, propertiesFromCsv } from '../lib/csv'
import { engineFromModelUsed } from '../lib/engine'
import { formatNumber, pluralize } from '../lib/format'
import { validateProperty } from '../lib/validation'
import {
  defaultSettings,
  emptyProperty,
  type ContentSettings,
  type ContentType,
  type LengthOption,
  type PropertyData,
  type Tone,
} from '../types'

type RowStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'stopped'

interface Row {
  id: string
  property: PropertyData
  status: RowStatus
  words: number
  error?: string
  result?: StreamResult
}

const MAX_ROWS = 20

const newRow = (property: PropertyData = emptyProperty()): Row => ({
  id: crypto.randomUUID(),
  property,
  status: 'idle',
  words: 0,
})

const statusText: Record<RowStatus, string> = {
  idle: 'Not started',
  queued: 'Queued',
  running: 'Writing',
  done: 'Done',
  failed: 'Failed',
  stopped: 'Stopped',
}

export function Batch() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>(() => [newRow()])
  const [settings, setSettings] = useState<ContentSettings>(() => ({
    ...defaultSettings(),
    tone: app.settings.tone,
    length: app.settings.length,
    contentType: app.settings.contentType,
  }))
  const [running, setRunning] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const setField = (id: string, key: keyof PropertyData, value: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, property: { ...r.property, [key]: value } } : r)))

  const invalid = rows.filter((r) => Object.keys(validateProperty(r.property)).length > 0)
  const done = rows.filter((r) => r.status === 'done').length
  const failed = rows.filter((r) => r.status === 'failed').length

  const runRow = async (row: Row, signal: AbortSignal) => {
    update(row.id, { status: 'running', words: 0, error: undefined })
    let words = 0
    try {
      const result = await generateContentStream(
        row.property,
        settings,
        (e) => {
          if (e.type === 'delta') {
            words += e.text.split(/\s+/).filter(Boolean).length
            update(row.id, { words })
          }
        },
        signal,
      )
      update(row.id, { status: 'done', result })
    } catch (err) {
      if (signal.aborted) update(row.id, { status: 'stopped' })
      else update(row.id, { status: 'failed', error: err instanceof Error ? err.message : 'Generation failed' })
    }
  }

  const runAll = async (only?: string) => {
    setShowErrors(true)
    if (invalid.length) {
      toast.show(`${pluralize(invalid.length, 'property needs', 'properties need')} a title and location first`, 'error')
      return
    }
    const targets = rows.filter((r) => (only ? r.id === only : r.status !== 'done'))
    if (!targets.length) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setRows((rs) => rs.map((r) => (targets.some((t) => t.id === r.id) ? { ...r, status: 'queued' } : r)))
    // One at a time: the model server handles one request well, and results arrive in order.
    for (const row of targets) {
      if (controller.signal.aborted) {
        update(row.id, { status: 'stopped' })
        continue
      }
      await runRow(row, controller.signal)
    }
    setRunning(false)
    abortRef.current = null
    if (!controller.signal.aborted) toast.show('Batch finished — everything is saved in your library')
  }

  const importCsv = () => {
    const { properties, ignored } = propertiesFromCsv(csvText)
    if (!properties.length) {
      setCsvError('No rows found. The first line must be a header row, e.g. "title,location,price".')
      return
    }
    const room = MAX_ROWS - rows.filter((r) => r.property.title || r.property.location).length
    const added = properties.slice(0, Math.max(0, room))
    setRows((rs) => [...rs.filter((r) => r.property.title || r.property.location), ...added.map((p) => newRow(p))])
    setCsvOpen(false)
    setCsvText('')
    setCsvError(null)
    toast.show(
      `Imported ${pluralize(added.length, 'property', 'properties')}` +
        (properties.length > added.length ? ` (limit is ${MAX_ROWS})` : '') +
        (ignored.length ? `. Ignored columns: ${ignored.join(', ')}` : ''),
      'info',
    )
  }

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Workspace', to: '/app' }, { label: 'Batch' }]} />
      <PageHeader
        title="Batch generate"
        description="Write content for several properties in one run. Each one is saved to your library as it finishes."
        actions={
          running ? (
            <Button variant="secondary" icon={<Square aria-hidden />} onClick={() => abortRef.current?.abort()}>
              Stop batch
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Play aria-hidden />}
              onClick={() => void runAll()}
              disabled={rows.every((r) => r.status === 'done')}
            >
              Generate {pluralize(rows.filter((r) => r.status !== 'done').length, 'property', 'properties')}
            </Button>
          )
        }
      />

      <StepTips step="batch" />

      <div className="layout-aside">
        <div className="stack">
          {rows.map((row, i) => {
            const errors = showErrors ? validateProperty(row.property) : {}
            const locked = running || row.status === 'done'
            return (
              <Card key={row.id} as="section" aria-label={`Property ${i + 1}`} className={`batch-row batch-row--${row.status}`}>
                <div className="batch-row__head">
                  <span className="batch-row__num">{i + 1}</span>
                  <span className="batch-row__title">{row.property.title || 'Untitled property'}</span>
                  <span className={`batch-status batch-status--${row.status}`} role="status">
                    {row.status === 'running' ? <Loader2 className="spin" aria-hidden /> : null}
                    {row.status === 'done' ? <CheckCircle2 aria-hidden /> : null}
                    {row.status === 'failed' ? <AlertCircle aria-hidden /> : null}
                    {row.status === 'queued' ? <Clock3 aria-hidden /> : null}
                    {statusText[row.status]}
                    {row.status === 'running' ? ` · ${formatNumber(row.words)} words` : ''}
                  </span>
                  {!locked && rows.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 aria-hidden />}
                      aria-label={`Remove property ${i + 1}`}
                      onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
                    />
                  ) : null}
                </div>

                {row.status === 'done' && row.result ? (
                  <div className="batch-row__done">
                    <EngineChip meta={engineFromModelUsed(row.result.model_used, row.result.generation_time_ms)} />
                    <span className="text-muted text-sm">Saved to your library</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        app.openResult(row.property, settings, row.result!)
                        navigate('/app/generated')
                      }}
                    >
                      Open in editor
                    </Button>
                  </div>
                ) : (
                  <fieldset className="batch-row__fields" disabled={locked}>
                    <legend className="sr-only">Details for property {i + 1}</legend>
                    <Input
                      label="Listing title"
                      required
                      value={row.property.title}
                      error={errors.title}
                      onChange={(e) => setField(row.id, 'title', e.target.value)}
                      placeholder="e.g. Renovated 2-bed apartment"
                    />
                    <Input
                      label="Location"
                      required
                      value={row.property.location}
                      error={errors.location}
                      onChange={(e) => setField(row.id, 'location', e.target.value)}
                      placeholder="e.g. Fitzroy, VIC"
                    />
                    <Input label="Price" value={row.property.price} onChange={(e) => setField(row.id, 'price', e.target.value)} />
                    <Input label="Beds" inputMode="decimal" value={row.property.bedrooms} error={errors.bedrooms} onChange={(e) => setField(row.id, 'bedrooms', e.target.value)} />
                    <Input label="Baths" inputMode="decimal" value={row.property.bathrooms} error={errors.bathrooms} onChange={(e) => setField(row.id, 'bathrooms', e.target.value)} />
                    <Input label="Parking" value={row.property.parking} onChange={(e) => setField(row.id, 'parking', e.target.value)} />
                    <Textarea
                      className="batch-row__wide"
                      label="Key features"
                      rows={2}
                      value={row.property.features}
                      onChange={(e) => setField(row.id, 'features', e.target.value)}
                      placeholder="Comma-separated, strongest first"
                    />
                  </fieldset>
                )}

                {row.status === 'failed' ? (
                  <Alert
                    tone="danger"
                    title="This property didn't generate"
                    actions={
                      <Button size="sm" variant="secondary" icon={<RotateCcw aria-hidden />} disabled={running} onClick={() => void runAll(row.id)}>
                        Try again
                      </Button>
                    }
                  >
                    {row.error}
                  </Alert>
                ) : null}
              </Card>
            )
          })}

          {!running ? (
            <div className="cluster">
              <Button
                variant="secondary"
                icon={<Plus aria-hidden />}
                disabled={rows.length >= MAX_ROWS}
                onClick={() => setRows((rs) => [...rs, newRow()])}
              >
                Add property
              </Button>
              <Button
                variant="ghost"
                icon={<Wand2 aria-hidden />}
                disabled={rows.length >= MAX_ROWS}
                onClick={() => setRows((rs) => [...rs.filter((r) => r.property.title || r.property.location), newRow({ ...sampleProperty })])}
              >
                Add the sample property
              </Button>
              <Button variant="ghost" icon={<FileSpreadsheet aria-hidden />} onClick={() => setCsvOpen(true)}>
                Import from spreadsheet
              </Button>
            </div>
          ) : (
            <p className="text-muted text-sm">Keep this page open while the batch runs.</p>
          )}
        </div>

        <div className="layout-aside__side">
          <Card as="section" aria-labelledby="batch-settings-title">
            <CardHeader level={3} titleId="batch-settings-title" icon={<Layers />} title="Batch settings" description="Applied to every property." />
            <fieldset className="stack" disabled={running}>
              <legend className="sr-only">Batch settings</legend>
              <Select
                label="Main focus"
                value={settings.contentType}
                onChange={(e) => setSettings((s) => ({ ...s, contentType: e.target.value as ContentType }))}
                options={contentTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
              <Select
                label="Tone"
                value={settings.tone}
                onChange={(e) => setSettings((s) => ({ ...s, tone: e.target.value as Tone }))}
                options={toneOptions}
              />
              <Select
                label="Length"
                value={settings.length}
                onChange={(e) => setSettings((s) => ({ ...s, length: e.target.value as LengthOption }))}
                options={lengthOptions}
              />
            </fieldset>
            <div className="divider" />
            <p className="batch-summary" role="status">
              {pluralize(rows.length, 'property', 'properties')} · {done} done{failed ? ` · ${failed} failed` : ''}
            </p>
            {done ? (
              <LinkButton to="/app/library" variant="ghost" size="sm">
                View results in library
              </LinkButton>
            ) : null}
          </Card>
        </div>
      </div>

      <Dialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        title="Import from a spreadsheet"
        description="Paste rows copied from Excel or Google Sheets, or a CSV file's contents. The first row must be column headers."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCsvOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={importCsv} disabled={!csvText.trim()}>
              Import
            </Button>
          </>
        }
      >
        <div className="stack">
          <Textarea
            label="Spreadsheet rows"
            rows={8}
            value={csvText}
            error={csvError ?? undefined}
            onChange={(e) => {
              setCsvText(e.target.value)
              setCsvError(null)
            }}
            placeholder={'title,location,price,bedrooms\nSunny cottage,"Castlemaine, VIC","$640,000",2'}
            data-autofocus
          />
          <p className="text-muted text-sm">
            Recognised columns: {CSV_COLUMNS}. Up to {MAX_ROWS} properties per batch.
          </p>
        </div>
      </Dialog>
    </div>
  )
}
