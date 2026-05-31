import { useNavigate } from 'react-router-dom'
import { Wand2 } from 'lucide-react'
import { Card } from '../components/Card'
import { useApp } from '../hooks/useApp'
import type { ContentType, LengthOption, Tone } from '../types'

const contentTypes: { id: ContentType; label: string }[] = [
  { id: 'listing', label: 'Listing Description' },
  { id: 'social', label: 'Social Media Post' },
  { id: 'email', label: 'Email' },
  { id: 'video', label: 'Video Script' },
]

const tones: { id: Tone; label: string }[] = [
  { id: 'formal', label: 'Formal' },
  { id: 'casual', label: 'Casual' },
  { id: 'promotional', label: 'Promotional' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'concise', label: 'Concise' },
  { id: 'friendly', label: 'Friendly' },
]

const lengths: { id: LengthOption; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'medium', label: 'Medium' },
  { id: 'long', label: 'Long' },
]

export function ContentSettings() {
  const { settings, setSettings, runGeneration, isGenerating } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/generated')
    await runGeneration()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Content settings</h1>
        <p className="page-lead">
          Choose what to generate first, set tone and length, and add optional keywords.
        </p>
      </div>

      <Card>
        <form className="settings-form" onSubmit={handleSubmit}>
          <fieldset className="fieldset">
            <legend className="fieldset__legend">Content type</legend>
            <p className="fieldset__hint">
              Primary focus for this run (all channels are still produced for review).
            </p>
            <div className="chip-group">
              {contentTypes.map(({ id, label }) => (
                <label key={id} className="chip">
                  <input
                    type="radio"
                    name="contentType"
                    checked={settings.contentType === id}
                    onChange={() => setSettings((s) => ({ ...s, contentType: id }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset__legend">Tone</legend>
            <div className="chip-group">
              {tones.map(({ id, label }) => (
                <label key={id} className="chip">
                  <input
                    type="radio"
                    name="tone"
                    checked={settings.tone === id}
                    onChange={() => setSettings((s) => ({ ...s, tone: id }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset__legend">Length</legend>
            <div className="chip-group">
              {lengths.map(({ id, label }) => (
                <label key={id} className="chip">
                  <input
                    type="radio"
                    name="length"
                    checked={settings.length === id}
                    onChange={() => setSettings((s) => ({ ...s, length: id }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span className="field__label">Optional keywords</span>
            <input
              className="input"
              value={settings.keywords}
              onChange={(e) =>
                setSettings((s) => ({ ...s, keywords: e.target.value }))
              }
              placeholder="e.g. north-facing, walk to schools, EV charger"
            />
          </label>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isGenerating}
            >
              <Wand2 size={18} aria-hidden />
              {isGenerating ? 'Generating…' : 'Generate Content'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
