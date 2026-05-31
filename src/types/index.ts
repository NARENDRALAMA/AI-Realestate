export type ContentType = 'listing' | 'social' | 'email' | 'video'

export type Tone = 'formal' | 'casual' | 'promotional' | 'luxury' | 'concise' | 'friendly'

export type LengthOption = 'short' | 'medium' | 'long'

export interface PropertyData {
  title: string
  price: string
  location: string
  address: string
  bedrooms: string
  bathrooms: string
  parking: string
  landSize: string
  interiorSize: string
  features: string
  amenities: string
  agentNotes: string
  imageFileName: string | null
  imagePath: string | null
}

export interface ContentSettings {
  contentType: ContentType
  tone: Tone
  length: LengthOption
  keywords: string
}

export interface GeneratedBundle {
  listing: string
  social: string
  email: string
  video: string
}

export interface VersionEntry {
  id: string
  label: string
  at: string
}

export const emptyProperty = (): PropertyData => ({
  title: '',
  price: '',
  location: '',
  address: '',
  bedrooms: '',
  bathrooms: '',
  parking: '',
  landSize: '',
  interiorSize: '',
  features: '',
  amenities: '',
  agentNotes: '',
  imageFileName: null,
  imagePath: null,
})

export const defaultSettings = (): ContentSettings => ({
  contentType: 'listing',
  tone: 'formal',
  length: 'medium',
  keywords: '',
})
