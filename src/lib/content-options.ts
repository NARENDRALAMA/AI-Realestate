import type { ContentType, ExtraFormat, GeneratedBundle, LengthOption, Tone } from '../types'

export const CHANNELS: (keyof GeneratedBundle)[] = ['listing', 'social', 'email', 'video']

export const channelLabels: Record<ContentType, string> = {
  listing: 'Listing',
  social: 'Social post',
  email: 'Email',
  video: 'Video script',
}

export const contentTypeOptions: { value: ContentType; label: string; description: string }[] = [
  {
    value: 'listing',
    label: 'Listing description',
    description: 'Portal-ready copy for realestate.com.au, Domain or your website.',
  },
  {
    value: 'social',
    label: 'Social media post',
    description: 'A short, scroll-stopping post with hashtags for Instagram or Facebook.',
  },
  {
    value: 'email',
    label: 'Email campaign',
    description: 'Subject line and body for your buyer database or newsletter.',
  },
  {
    value: 'video',
    label: 'Video script',
    description: 'A timed walk-through script for a reel or property video.',
  },
]

export const toneOptions: { value: Tone; label: string; description: string }[] = [
  { value: 'formal', label: 'Formal', description: 'Polished and professional. Suits most listings.' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and welcoming, like a chat at an open home.' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational. Good for social.' },
  { value: 'promotional', label: 'Promotional', description: 'Energetic, with urgency and a strong call to action.' },
  { value: 'luxury', label: 'Luxury', description: 'Refined and aspirational for premium properties.' },
  { value: 'concise', label: 'Concise', description: 'Straight to the facts. No fluff.' },
]

export const lengthOptions: { value: LengthOption; label: string; description: string }[] = [
  { value: 'short', label: 'Short', description: 'Key facts only' },
  { value: 'medium', label: 'Medium', description: 'Balanced detail' },
  { value: 'long', label: 'Long', description: 'Full story' },
  { value: 'extended', label: 'Extra long', description: 'In-depth, 400+ words' },
]

export const extraFormatOptions: { value: ExtraFormat; label: string; description: string }[] = [
  { value: 'headlines', label: 'Headline options', description: 'Five alternative headlines to test on portals and ads.' },
  { value: 'facebook_ad', label: 'Facebook ad', description: 'Primary text, headline, description and call to action.' },
  { value: 'sms', label: 'SMS / text blast', description: 'One message under 160 characters for your buyer list.' },
  { value: 'flyer', label: 'Open-home flyer', description: 'Headline, intro, bullet points and an invitation to inspect.' },
  { value: 'seo', label: 'SEO title & description', description: 'Metadata for the listing page on your website.' },
]

export const extraFormatLabel: Record<ExtraFormat, string> = Object.fromEntries(
  extraFormatOptions.map((o) => [o.value, o.label]),
) as Record<ExtraFormat, string>

export const variationOptions: { value: '1' | '2' | '3'; label: string; description: string }[] = [
  { value: '1', label: 'One version', description: 'Fastest' },
  { value: '2', label: 'Two versions', description: 'Compare and pick' },
  { value: '3', label: 'Three versions', description: 'Most choice, slowest' },
]

/** Human label for a streaming job id such as "listing:1" or "extra:sms". */
export function jobLabel(job: string, variations: number) {
  const [kind, rest] = job.split(':')
  if (kind === 'extra') return extraFormatLabel[rest as ExtraFormat] ?? rest
  const base = channelLabels[kind as ContentType] ?? kind
  return variations > 1 ? `${base} · version ${Number(rest) + 1}` : base
}

const lookup = <T extends string>(list: { value: T; label: string }[]) => (v: string) =>
  list.find((o) => o.value === v)?.label ?? v

export const toneLabel = lookup(toneOptions)
export const lengthLabel = lookup(lengthOptions)
export const contentTypeLabel = lookup(contentTypeOptions)
