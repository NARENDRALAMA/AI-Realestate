/**
 * API client for the REM Content Studio backend.
 * Translates between the frontend's camelCase types and the backend's snake_case API.
 */

import type {
  ContentSettings,
  GeneratedBundle,
  PropertyData,
} from '../types'

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

export interface LibraryItem {
  id: number
  title: string
  location: string
  content_type: string
  tone: string
  preview: string
  created_at: string
}

export interface LibraryDetail extends LibraryItem {
  bundle: GeneratedBundle
}

export interface GenerateResult {
  id: number
  bundle: GeneratedBundle
}

export interface StatsResponse {
  total: number
  this_week: number
  by_type: Record<string, number>
  by_tone: Record<string, number>
  recent: Array<{
    title: string
    content_type: string
    tone: string
    created_at: string
  }>
}

// ─── generate ─────────────────────────────────────────────────────────────────

export async function generateContent(
  property: PropertyData,
  settings: ContentSettings,
): Promise<GenerateResult> {
  const body = {
    title: property.title,
    price: property.price,
    location: property.location,
    address: property.address,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    land_size: property.landSize,
    interior_size: property.interiorSize,
    features: property.features,
    amenities: property.amenities,
    agent_notes: property.agentNotes,
    image_path: property.imagePath ?? '',
    content_type: settings.contentType,
    tone: settings.tone,
    length: settings.length,
    keywords: settings.keywords,
  }

  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      (err as { detail?: string }).detail ?? `Generation failed (${res.status})`,
    )
  }

  return res.json() as Promise<GenerateResult>
}

// ─── refine ───────────────────────────────────────────────────────────────────

export type RefineType = 'tone' | 'persuasive' | 'shorten'

export async function refineContent(
  type: RefineType,
  channel: keyof GeneratedBundle,
  content: string,
  property: PropertyData,
  settings: ContentSettings,
): Promise<string> {
  const body = {
    content,
    channel,
    tone: settings.tone,
    length: settings.length,
    title: property.title,
    price: property.price,
    location: property.location,
    address: property.address,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    parking: property.parking,
    land_size: property.landSize,
    interior_size: property.interiorSize,
    features: property.features,
    amenities: property.amenities,
    agent_notes: property.agentNotes,
    keywords: settings.keywords,
  }

  const res = await fetch(`${BASE}/refine/${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Refine failed (${res.status})`)
  const data = await res.json() as { refined: string }
  return data.refined
}

// ─── library ──────────────────────────────────────────────────────────────────

export async function fetchLibrary(): Promise<LibraryItem[]> {
  const res = await fetch(`${BASE}/library`)
  if (!res.ok) throw new Error(`Library fetch failed (${res.status})`)
  return res.json() as Promise<LibraryItem[]>
}

export async function fetchLibraryItem(id: number): Promise<LibraryDetail> {
  const res = await fetch(`${BASE}/library/${id}`)
  if (!res.ok) throw new Error(`Item fetch failed (${res.status})`)
  return res.json() as Promise<LibraryDetail>
}

export async function deleteLibraryItem(id: number): Promise<void> {
  const res = await fetch(`${BASE}/library/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed (${res.status})`)
}

// ─── stats ────────────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<StatsResponse> {
  const res = await fetch(`${BASE}/stats`)
  if (!res.ok) throw new Error(`Stats fetch failed (${res.status})`)
  return res.json() as Promise<StatsResponse>
}

// ─── image upload ─────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload-image`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed (${res.status})`)
  const data = await res.json() as { path: string }
  return data.path
}

// ─── export ───────────────────────────────────────────────────────────────────

export async function exportContent(
  bundle: GeneratedBundle,
  format: 'txt' | 'pdf' | 'docx',
  title: string,
  tone: string,
): Promise<void> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bundle, format, title, tone }),
  })

  if (!res.ok) throw new Error(`Export failed (${res.status})`)

  const blob = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(contentDisposition)
  const filename = match ? match[1] : `rem-content.${format}`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
