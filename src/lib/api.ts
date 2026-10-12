/**
 * API client for the REM Content Studio backend.
 * Translates between the frontend's camelCase types and the backend's snake_case API.
 */

import type {
  ContentSettings,
  ExtraFormat,
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
  model_used: string
  generation_time_ms: number
  created_at: string
}

export interface LibraryDetail extends LibraryItem {
  bundle: GeneratedBundle
  /** Present for runs made through the streaming endpoint with extras or variations. */
  extras?: Partial<Record<ExtraFormat, string>>
  variants?: Partial<Record<keyof GeneratedBundle, string[]>>
}

export interface GenerateResult {
  id: number
  bundle: GeneratedBundle
  /** "template", "<model name>", or "<model name> (partial)". */
  model_used: string
  generation_time_ms: number
}

// ─── errors ───────────────────────────────────────────────────────────────────

/** Error with a plain-English message and, for validation errors, messages per field. */
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>

  constructor(message: string, status = 0, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

const humanise = (field: string) => {
  const words = field.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function cleanMessage(msg: string, field: string) {
  const m = msg.replace(/^Value error,\s*/i, '')
  if (/field required/i.test(m)) return `${humanise(field)} is required`
  return m.charAt(0).toUpperCase() + m.slice(1)
}

function statusMessage(status: number, fallback: string) {
  if (status >= 500) return `${fallback}. The server ran into a problem — please try again.`
  if (status === 404) return `${fallback}. It may have been deleted.`
  return `${fallback} (error ${status}).`
}

/** Turns a failed response (including FastAPI 422 validation arrays) into an ApiError. */
async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { detail?: unknown } | null
  const detail = body?.detail

  if (typeof detail === 'string' && detail.trim()) {
    return new ApiError(detail, res.status)
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {}
    const messages: string[] = []
    for (const item of detail as Array<{ loc?: unknown[]; msg?: string }>) {
      const loc = Array.isArray(item.loc) ? item.loc : []
      const raw = String(loc[loc.length - 1] ?? '')
      const msg = cleanMessage(item.msg ?? 'Invalid value', raw)
      if (raw && raw !== 'body') fieldErrors[snakeToCamel(raw)] = msg
      messages.push(msg)
    }
    if (messages.length) {
      return new ApiError(`Please check your details: ${messages.join('; ')}.`, res.status, fieldErrors)
    }
  }

  return new ApiError(statusMessage(res.status, fallback), res.status)
}

/** fetch() that reports network failures in plain English. */
async function send(url: string, init: RequestInit | undefined, fallback: string) {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError(
      `${fallback}. We couldn't reach the server — check your connection and try again.`,
    )
  }
  if (!res.ok) throw await toApiError(res, fallback)
  return res
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

/** The /api/generate request body (unchanged contract). */
function generateBody(property: PropertyData, settings: ContentSettings) {
  return {
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
}

export async function generateContent(
  property: PropertyData,
  settings: ContentSettings,
): Promise<GenerateResult> {
  const body = generateBody(property, settings)

  const res = await send(
    `${BASE}/generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    "Couldn't generate content",
  )

  return res.json() as Promise<GenerateResult>
}

// ─── live (streaming) generate ───────────────────────────────────────────────

export type JobSource = 'ai' | 'template'

export type StreamEvent =
  | { type: 'start'; engine: 'ai' | 'template'; model: string | null; jobs: string[] }
  | { type: 'delta'; job: string; text: string }
  | { type: 'job_done'; job: string; source: JobSource; text: string }
  | ({ type: 'done' } & StreamResult)
  | { type: 'error'; message: string }

export interface StreamResult extends GenerateResult {
  variants: Partial<Record<keyof GeneratedBundle, string[]>>
  extras: Partial<Record<ExtraFormat, string>>
}

/** Thrown when the server has no streaming endpoint (e.g. an older deployment). */
export class StreamUnsupportedError extends Error {}

/**
 * POST /api/generate/stream — calls `onEvent` for every newline-delimited JSON event as
 * the model writes, and resolves with the final result. Abort with `signal` to stop.
 */
export async function generateContentStream(
  property: PropertyData,
  settings: ContentSettings,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const body = {
    ...generateBody(property, settings),
    extra_formats: settings.extraFormats,
    variations: settings.variations,
  }

  let res: Response
  try {
    res = await fetch(`${BASE}/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError(
      "Couldn't generate content. We couldn't reach the server — check your connection and try again.",
    )
  }
  if (res.status === 404 || res.status === 405) throw new StreamUnsupportedError()
  if (!res.ok) throw await toApiError(res, "Couldn't generate content")
  if (!res.body) throw new StreamUnsupportedError()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: StreamResult | null = null

  const handle = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as StreamEvent
    if (event.type === 'error') throw new ApiError(event.message)
    if (event.type === 'done') {
      const { type: _type, ...rest } = event
      void _type
      result = rest
    }
    onEvent(event)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline !== -1) {
      handle(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  handle(buffer + decoder.decode())

  if (!result) {
    throw new ApiError("The connection closed before generation finished. Please try again.")
  }
  return result
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

  const res = await send(
    `${BASE}/refine/${type}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    "Couldn't refine this text",
  )
  const data = await res.json() as { refined: string }
  return data.refined
}

// ─── library ──────────────────────────────────────────────────────────────────

export async function fetchLibrary(): Promise<LibraryItem[]> {
  const res = await send(`${BASE}/library`, undefined, "Couldn't load your library")
  return res.json() as Promise<LibraryItem[]>
}

export async function fetchLibraryItem(id: number): Promise<LibraryDetail> {
  const res = await send(`${BASE}/library/${id}`, undefined, "Couldn't open this item")
  return res.json() as Promise<LibraryDetail>
}

export async function deleteLibraryItem(id: number): Promise<void> {
  await send(`${BASE}/library/${id}`, { method: 'DELETE' }, "Couldn't delete this item")
}

// ─── stats ────────────────────────────────────────────────────────────────────

export async function fetchStats(): Promise<StatsResponse> {
  const res = await send(`${BASE}/stats`, undefined, "Couldn't load stats")
  return res.json() as Promise<StatsResponse>
}

// ─── image upload ─────────────────────────────────────────────────────────────

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await send(
    `${BASE}/upload-image`,
    { method: 'POST', body: form },
    "Couldn't upload the photo",
  )
  const data = await res.json() as { path: string }
  return data.path
}

// ─── export ───────────────────────────────────────────────────────────────────

export async function exportContent(
  bundle: GeneratedBundle,
  format: 'txt' | 'pdf' | 'docx',
  title: string,
  tone: string,
  extras: Partial<Record<ExtraFormat, string>> = {},
): Promise<void> {
  const res = await send(
    `${BASE}/export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle, format, title, tone, extras }),
    },
    `Couldn't create the ${format.toUpperCase()} file`,
  )

  const blob = await res.blob()
  const contentDisposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(contentDisposition)
  const filename = match ? match[1] : `rem-content.${format}`

  downloadBlob(blob, filename)
}

/** Saves a blob as a file. Revokes the object URL after the click has been handled. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
