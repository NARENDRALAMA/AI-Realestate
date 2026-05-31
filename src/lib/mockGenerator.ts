import type {
  ContentSettings,
  GeneratedBundle,
  LengthOption,
  PropertyData,
  Tone,
} from '../types'

function trimToLength(text: string, length: LengthOption): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const limits = { short: 3, medium: 6, long: 12 }
  const limit = limits[length]
  if (sentences.length === 0) return text
  const joined = sentences.slice(0, limit).join(' ')
  if (joined.trim()) return joined
  const approx = length === 'short' ? 280 : length === 'medium' ? 640 : 1200
  return text.length <= approx ? text : `${text.slice(0, approx).trim()}…`
}

function kw(settings: ContentSettings): string {
  const k = settings.keywords.trim()
  if (k) return ` Keywords to reflect: ${k}.`
  return ''
}

function tonePhrases(tone: Tone) {
  switch (tone) {
    case 'formal':
      return {
        open: 'We are pleased to present',
        hook: 'This residence offers',
        close: 'We invite qualified purchasers to arrange a private inspection.',
      }
    case 'casual':
      return {
        open: "You're going to love",
        hook: 'This place nails',
        close: 'Message us to book a walk-through—happy to answer questions.',
      }
    case 'promotional':
      return {
        open: 'JUST LISTED',
        hook: 'Standout features include',
        close: 'Act fast—this one will not sit long. Book your viewing today.',
      }
    default:
      return {
        open: 'We are pleased to present',
        hook: 'This residence offers',
        close: 'Contact us to arrange an inspection.',
      }
  }
}

export function generateMockContent(
  property: PropertyData,
  settings: ContentSettings,
): GeneratedBundle {
  const title = property.title.trim() || 'Premium Residential Listing'
  const loc = property.location.trim() || 'Prime location'
  const addr = property.address.trim() || 'Address on request'
  const price = property.price.trim() || 'Price on application'
  const beds = property.bedrooms || '—'
  const baths = property.bathrooms || '—'
  const park = property.parking || '—'
  const land = property.landSize || '—'
  const interior = property.interiorSize || '—'
  const feats = property.features.trim() || 'Quality finishes throughout.'
  const amen = property.amenities.trim() || 'Modern conveniences included.'
  const notes = property.agentNotes.trim()
  const t = tonePhrases(settings.tone)
  const extra = kw(settings)

  const listingBase = `${t.open} ${title} in ${loc}. ${t.hook} ${beds} bedrooms, ${baths} bathrooms, and ${park} secure parking, set on approximately ${land} with ~${interior} of interior living. ${feats} ${amen} ${notes ? `Agent notes: ${notes}.` : ''}${extra} ${t.close}`

  const socialBase =
    settings.tone === 'promotional'
      ? `🔥 ${title} — ${price} in ${loc}. ${beds} beds · ${baths} baths · ${park} cars. ${feats.slice(0, 120)}… #RealEstate #${loc.split(',')[0]?.replace(/\s/g, '') ?? 'Home'}`
      : settings.tone === 'casual'
        ? `New on our desk: ${title} (${loc}). Think ${beds} beds, chill courtyard vibes, and a kitchen you will actually cook in. ${price}. DM for a tour.`
        : `Now available: ${title}, ${addr}. ${beds} bedrooms, ${baths} bathrooms, ${park} parking. ${price}. Contact us for a private viewing.`

  const emailSubject =
    settings.tone === 'formal'
      ? `New instruction: ${title} — ${loc}`
      : settings.tone === 'casual'
        ? `Quick look: ${title} (${price})`
        : `Hot listing: ${title} — ${price}`

  const emailBody = `Subject: ${emailSubject}

Hi there,

${settings.tone === 'formal' ? 'I am writing to' : settings.tone === 'casual' ? 'Wanted to' : "You're among the first to hear about"} ${title} in ${loc}.

Highlights:
• ${beds} bed / ${baths} bath / ${park} parking
• Land ${land}, interior ~${interior}
• ${feats}
• ${amen}
${notes ? `• Note for buyers: ${notes}` : ''}

${settings.tone === 'promotional' ? 'This opportunity is drawing strong interest—reply today to secure a viewing window.' : settings.tone === 'casual' ? 'If this sounds like your next move, ping me and we will line up a time.' : 'Please contact our office to arrange a confidential inspection.'}

Kind regards,
Your Property Marketing Desk`

  const videoBase = `[0:00–0:15] Opening — ${settings.tone === 'formal' ? 'Welcome to' : settings.tone === 'casual' ? "Here's" : 'Get ready for'} ${title} in ${loc}. ${price}.
[0:15–0:45] Walk-through — ${beds} bedrooms, ${baths} bathrooms, ${park} parking; approximately ${interior} internal space on ${land}.
[0:45–1:10] Lifestyle — ${feats}
[1:10–1:30] Call to action — ${t.close}`

  return {
    listing: trimToLength(listingBase, settings.length),
    social: trimToLength(socialBase, settings.length === 'short' ? 'short' : 'medium'),
    email: trimToLength(emailBody, settings.length),
    video: trimToLength(videoBase, settings.length),
  }
}

export function mockImproveTone(text: string): string {
  return `${text.trim()}\n\n[Refinement] Language elevated for clarity and professional tone while preserving factual detail.`
}

export function mockMorePersuasive(text: string): string {
  return `${text.trim()}\n\n[Persuasion pass] Emphasis added on buyer benefits, lifestyle upside, and urgency without altering core facts.`
}

export function mockShorten(text: string): string {
  const parts = text.trim().split(/\n+/)
  return parts.slice(0, Math.max(1, Math.ceil(parts.length / 2))).join('\n')
}
