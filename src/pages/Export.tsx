import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  FileSearch,
  FileText,
  FileType2,
  Plus,
  RotateCcw,
} from 'lucide-react'
import { ChannelPanel, ExtraPanel } from '../components/ChannelPanel'
import { ReviewNav } from '../components/ReviewNav'
import { StartNewDialog } from '../components/StartNewDialog'
import { Alert } from '../components/ui/Alert'
import { Button, LinkButton } from '../components/ui/Button'
import { Card, CardHeader } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { StepTips } from '../components/StepTips'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { downloadBlob, exportContent } from '../lib/api'
import { channelLabels, CHANNELS, extraFormatLabel, toneLabel } from '../lib/content-options'
import { copyText } from '../lib/copy'
import type { ExtraFormat, GeneratedBundle } from '../types'

type Format = 'txt' | 'pdf' | 'docx'

const formats: { id: Format; label: string; description: string; icon: typeof FileText }[] = [
  { id: 'pdf', label: 'PDF', description: 'Formatted and ready to share', icon: FileText },
  { id: 'docx', label: 'Word (DOCX)', description: 'Editable in Microsoft Word', icon: FileType2 },
  { id: 'txt', label: 'Plain text (TXT)', description: 'Paste into any app or CRM', icon: Download },
]

// Same pattern as the server's PDF/DOCX names (backend/main.py export_content).
const txtFilename = (title: string, tone: string) =>
  `rem-content-${(title || 'Property').replace(/[^A-Za-z0-9\-_ ]/g, '_').slice(0, 40)}-${tone}.txt`

const fullPack = (g: GeneratedBundle, extras: Partial<Record<ExtraFormat, string>>) =>
  [
    ...CHANNELS.map((ch) => `## ${channelLabels[ch]}\n\n${g[ch]}`),
    ...(Object.entries(extras) as [ExtraFormat, string][]).map(
      ([fmt, text]) => `## ${extraFormatLabel[fmt]}\n\n${text}`,
    ),
  ].join('\n\n---\n\n')

export function Export() {
  const { generated, drafts, property, settings, generationId, finalizeEdits, extras } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState<string>(settings.contentType)
  const [exporting, setExporting] = useState<Format | null>(null)
  const [exportError, setExportError] = useState<{ format: Format; message: string } | null>(null)
  const [confirmNew, setConfirmNew] = useState(false)

  if (!generated) {
    return (
      <>
        <ReviewNav />
        <Card padding="lg">
          <EmptyState
            headingLevel={1}
            icon={<FileSearch />}
            title="Nothing to export yet"
            description="Generate content first. You can export it here as PDF, Word or plain text."
            actions={
              <LinkButton to="/app/property" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
                Start with property details
              </LinkButton>
            }
          />
        </Card>
      </>
    )
  }

  const unsynced = !!drafts && CHANNELS.some((c) => drafts[c] !== generated[c])

  const handleCopyAll = async () => {
    const ok = await copyText(fullPack(generated, extras))
    toast.show(
      ok ? 'All content copied to clipboard' : "Couldn't copy. Try downloading instead.",
      ok ? 'success' : 'error',
    )
  }

  const handleDownload = async (format: Format) => {
    setExportError(null)
    if (format === 'txt') {
      const blob = new Blob([fullPack(generated, extras)], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, txtFilename(property.title, settings.tone))
      toast.show('TXT file downloaded')
      return
    }
    setExporting(format)
    try {
      await exportContent(generated, format, property.title || 'Property', settings.tone, extras)
      toast.show(`${format.toUpperCase()} file downloaded`)
    } catch (err) {
      setExportError({
        format,
        message: err instanceof Error ? err.message : 'Export failed.',
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <ReviewNav />
      <PageHeader
        eyebrow="Step 4"
        title="Export"
        description={`${toneLabel(settings.tone)} tone. Copy a single channel, copy everything, or download a file.`}
      />

      <StepTips step="export" />

      {unsynced ? (
        <Alert
          tone="info"
          title="You have edits that aren't in this export"
          className="page-alert"
          actions={
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (drafts) finalizeEdits(drafts)
                toast.show('Latest edits included')
              }}
            >
              Include latest edits
            </Button>
          }
        >
          The preview and downloads below use the version you last finalized.
        </Alert>
      ) : null}

      <div className="layout-aside">
        <Card padding="lg">
          <Tabs
            label="Channels to export"
            value={tab}
            onChange={setTab}
            items={[
              ...CHANNELS.map((ch) => ({ id: ch as string, label: channelLabels[ch] })),
              ...(Object.keys(extras) as ExtraFormat[]).map((fmt) => ({
                id: `extra:${fmt}`,
                label: extraFormatLabel[fmt],
              })),
            ]}
          >
            {tab.startsWith('extra:') ? (
              <ExtraPanel format={tab.slice(6) as ExtraFormat} text={extras[tab.slice(6) as ExtraFormat] ?? ''} />
            ) : (
              <ChannelPanel channel={tab as keyof GeneratedBundle} text={generated[tab as keyof GeneratedBundle]} />
            )}
          </Tabs>
        </Card>

        <div className="layout-aside__side">
          <Card as="section" aria-labelledby="download-title">
            <CardHeader
              level={3}
              titleId="download-title"
              icon={<Download />}
              title="Download"
              description={
                Object.keys(extras).length
                  ? `All four channels plus ${Object.keys(extras).length} extra format${Object.keys(extras).length === 1 ? '' : 's'}.`
                  : 'Includes all four channels.'
              }
            />
            <div className="stack stack--sm">
              {formats.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="format-option"
                  onClick={() => void handleDownload(id)}
                  disabled={exporting !== null}
                  aria-busy={exporting === id || undefined}
                >
                  <Icon className="format-option__icon" aria-hidden />
                  <span className="format-option__text">
                    <span className="format-option__label">{label}</span>
                    <span className="format-option__desc">
                      {exporting === id ? 'Preparing file…' : description}
                    </span>
                  </span>
                  <Download className="format-option__action" aria-hidden />
                </button>
              ))}
            </div>
            {exportError ? (
              <Alert
                tone="danger"
                className="section-alert"
                title={`${exportError.format.toUpperCase()} download failed`}
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RotateCcw aria-hidden />}
                    onClick={() => void handleDownload(exportError.format)}
                  >
                    Try again
                  </Button>
                }
              >
                {exportError.message}
              </Alert>
            ) : null}
            <div className="divider" />
            <Button variant="primary" block icon={<Copy aria-hidden />} onClick={handleCopyAll}>
              Copy everything
            </Button>
          </Card>

          <Card as="section" aria-labelledby="library-title">
            <CardHeader level={3} titleId="library-title" icon={<BookOpen />} title="Library" />
            <p className="saved-note">
              <CheckCircle2 aria-hidden />
              {generationId !== null
                ? 'Saved automatically when it was generated.'
                : 'Every generation is saved automatically.'}
            </p>
            <div className="stack stack--sm">
              <LinkButton to="/app/library" variant="secondary" block>
                View in library
              </LinkButton>
              <Button variant="ghost" block icon={<Plus aria-hidden />} onClick={() => setConfirmNew(true)}>
                Start new content
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <StartNewDialog open={confirmNew} onClose={() => setConfirmNew(false)} />
    </>
  )
}
