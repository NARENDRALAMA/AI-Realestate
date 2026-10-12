import type { ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { useApp } from '../hooks/useApp'
import { useToast } from '../hooks/useToast'
import { channelLabels, extraFormatLabel, PLATFORM_CHAR_LIMITS, platformLabel } from '../lib/content-options'
import { copyText } from '../lib/copy'
import { countChars, countWords, formatNumber } from '../lib/format'
import type { ExtraFormat, GeneratedBundle } from '../types'
import { Button } from './ui/Button'
import { SegmentedToggle } from './ui/SegmentedToggle'

/** Word/character counts for a channel. Social shows characters against the platform limit. */
export function ChannelCounts({
  channel,
  text,
}: {
  channel: keyof GeneratedBundle
  text: string
}) {
  const { settings } = useApp()
  const limit = PLATFORM_CHAR_LIMITS[settings.platform]
  const chars = countChars(text)
  return (
    <span className="channel-counts">
      <span>{formatNumber(countWords(text))} words</span>
      {channel === 'social' ? (
        <span className={chars > limit ? 'channel-counts__over' : undefined}>
          {formatNumber(chars)} / {formatNumber(limit)} characters ({platformLabel(settings.platform)})
          {chars > limit ? ' — over the limit' : ''}
        </span>
      ) : null}
    </span>
  )
}

export function CopyButton({
  text,
  label,
  size = 'sm',
}: {
  text: string
  label: string
  size?: 'sm' | 'md'
}) {
  const toast = useToast()
  return (
    <Button
      size={size}
      variant="secondary"
      icon={<Copy aria-hidden />}
      onClick={async () => {
        const ok = await copyText(text)
        toast.show(ok ? `${label} copied to clipboard` : "Couldn't copy. Select the text and copy it manually.", ok ? 'success' : 'error')
      }}
    >
      Copy
      <span className="sr-only"> {label}</span>
    </Button>
  )
}

/** Read-only view of one channel's copy with counts and a copy button. */
export function ChannelPanel({
  channel,
  text,
  actions,
}: {
  channel: keyof GeneratedBundle
  text: string
  actions?: ReactNode
}) {
  const label = channelLabels[channel]
  return (
    <div className="channel-panel">
      <div className="channel-panel__bar">
        <ChannelCounts channel={channel} text={text} />
        <div className="cluster">
          {actions}
          <CopyButton text={text} label={label} />
        </div>
      </div>
      <pre className="prose-output channel-panel__body">{text}</pre>
    </div>
  )
}

/** Read-only view of an extra format (headlines, SMS, …) with counts and a copy button. */
export function ExtraPanel({ format, text }: { format: ExtraFormat; text: string }) {
  const label = extraFormatLabel[format]
  const chars = countChars(text)
  return (
    <div className="channel-panel">
      <div className="channel-panel__bar">
        <span className="channel-counts">
          <span>{formatNumber(countWords(text))} words</span>
          <span className={format === 'sms' && chars > 160 ? 'channel-counts__over' : undefined}>
            {formatNumber(chars)} characters{format === 'sms' ? ' of 160' : ''}
            {format === 'sms' && chars > 160 ? ' — too long for one text; shorten before sending' : ''}
          </span>
        </span>
        <CopyButton text={text} label={label} />
      </div>
      <pre className="prose-output channel-panel__body">{text}</pre>
    </div>
  )
}

/**
 * Switches which version of a channel is in use. Disabled once the text has been edited,
 * so switching never silently throws away the user's changes.
 */
export function VersionPicker({
  count,
  selected,
  onSelect,
}: {
  count: number
  /** Index of the version in use, or -1 when the text has been edited. */
  selected: number
  onSelect: (index: number) => void
}) {
  if (count < 2) return null
  if (selected < 0) {
    return <p className="version-picker__note">Edited — the other versions are kept in your library.</p>
  }
  return (
    <div className="version-picker">
      <span className="version-picker__label" id="version-picker-label">
        Versions
      </span>
      <SegmentedToggle
        label="Choose a version"
        value={String(selected)}
        onChange={(v) => onSelect(Number(v))}
        options={Array.from({ length: count }, (_, i) => ({ value: String(i), label: `${i + 1}` }))}
      />
    </div>
  )
}
