import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Copy, Download, FileText, Library, Loader2, Save } from 'lucide-react'
import { Card } from '../components/Card'
import { useApp } from '../hooks/useApp'
import { exportContent, fetchLibraryItem } from '../lib/api'
import { copyText } from '../lib/copy'
import type { GeneratedBundle } from '../types'

const sections: { key: keyof GeneratedBundle; title: string }[] = [
  { key: 'listing', title: 'Listing Description' },
  { key: 'social', title: 'Social Post' },
  { key: 'email', title: 'Email Copy' },
  { key: 'video', title: 'Video Script' },
]

export function Export() {
  const { generated, property, settings, generationId } = useApp()
  const navigate = useNavigate()
  const [toast, setToast] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const fullPack = (g: GeneratedBundle) =>
    sections.map((s) => `## ${s.title}\n\n${g[s.key]}`).join('\n\n---\n\n')

  const handleCopyAll = async () => {
    if (!generated) return
    const ok = await copyText(fullPack(generated))
    showToast(ok ? 'Full pack copied' : 'Copy failed')
  }

  const handleDownload = async (format: 'txt' | 'pdf' | 'docx') => {
    if (!generated) return
    if (format === 'txt') {
      const blob = new Blob([fullPack(generated)], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rem-content-${settings.tone}-${Date.now()}.txt`
      a.click()
      URL.revokeObjectURL(url)
      showToast('TXT download started')
      return
    }
    setExporting(format)
    try {
      await exportContent(
        generated,
        format,
        property.title || 'Property',
        settings.tone,
      )
      showToast(`${format.toUpperCase()} download started`)
    } catch {
      showToast(`${format.toUpperCase()} export failed — is the backend running?`)
    } finally {
      setExporting(null)
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      if (generationId !== null) {
        // Generation auto-saves — verify it's in the library then navigate
        await fetchLibraryItem(generationId)
        showToast('Already saved to library')
      } else {
        showToast('Saved to library')
      }
      setSaved(true)
      window.setTimeout(() => navigate('/library'), 1500)
    } catch {
      // Edge case: record missing, still navigate to library
      showToast('Navigating to library…')
      window.setTimeout(() => navigate('/library'), 1500)
    } finally {
      setSaving(false)
    }
  }

  if (!generated) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1 className="page-title">Nothing to export</h1>
          <p className="page-lead">Finalize edits to prepare a clean export pack.</p>
          <Link to="/edit" className="btn btn--primary">
            Go to review
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      {toast ? <div className="toast" role="status">{toast}</div> : null}

      <div className="page-header">
        <h1 className="page-title">Export</h1>
        <p className="page-lead">
          Channel-ready copy — tone: <strong>{settings.tone}</strong>. Copy, download
          in your preferred format, or save to the library.
        </p>
        <div className="toolbar">
          <button type="button" className="btn btn--primary" onClick={handleCopyAll}>
            <Copy size={18} aria-hidden />
            Copy all
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => handleDownload('txt')}
            title="Download as plain text"
          >
            <Download size={18} aria-hidden />
            TXT
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => handleDownload('pdf')}
            disabled={exporting === 'pdf'}
            title="Download as PDF"
          >
            {exporting === 'pdf'
              ? <Loader2 size={18} className="spin" aria-hidden />
              : <FileText size={18} aria-hidden />}
            PDF
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => handleDownload('docx')}
            disabled={exporting === 'docx'}
            title="Download as Word document"
          >
            {exporting === 'docx'
              ? <Loader2 size={18} className="spin" aria-hidden />
              : <FileText size={18} aria-hidden />}
            DOCX
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saving
              ? <Loader2 size={18} className="spin" aria-hidden />
              : saved
                ? <Check size={18} aria-hidden />
                : <Save size={18} aria-hidden />}
            {saved ? 'Saved' : 'Save to Library'}
            {saved && <Library size={16} aria-hidden style={{ marginLeft: 2 }} />}
          </button>
        </div>
      </div>

      <div className="export-grid">
        {sections.map(({ key, title }) => (
          <Card key={key}>
            <div className="export-block">
              <div className="export-block__head">
                <h2>{title}</h2>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={async () => {
                    const ok = await copyText(generated[key])
                    showToast(ok ? `Copied ${title}` : 'Copy failed')
                  }}
                >
                  <Copy size={16} aria-hidden />
                  Copy
                </button>
              </div>
              <pre className="export-block__body">{generated[key]}</pre>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
