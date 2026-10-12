import type { JobSource, StreamResult } from '../lib/api'
import type {
  ContentSettings,
  ExtraFormat,
  GeneratedBundle,
  GenerationMeta,
  PropertyData,
  VersionEntry,
} from '../types'

/** Whether edits to the current result have been saved to the library. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface LiveJob {
  text: string
  status: 'waiting' | 'writing' | 'done'
  source?: JobSource
}

/** What's being written right now, job by job (see /api/generate/stream). */
export interface LiveGeneration {
  engine: 'ai' | 'template'
  model: string | null
  jobs: string[]
  byJob: Record<string, LiveJob>
  variations: number
}

export interface AppState {
  property: PropertyData
  settings: ContentSettings
  generated: GeneratedBundle | null
  drafts: GeneratedBundle | null
  versionHistory: VersionEntry[]
  isGenerating: boolean
  generationError: string | null
  generationId: number | null
  saveState: SaveState
  /** Field-level messages from the last failed generation (e.g. a 422 from the API). */
  generationFieldErrors: Record<string, string>
  /** Epoch ms when the running generation started, for the progress timer. */
  generationStartedAt: number | null
  generationMeta: GenerationMeta | null
  /** Object URL of the chosen photo, for previews across steps (browser-only). */
  imagePreview: string | null
  /** Live progress of the current run; null before the server responds. */
  live: LiveGeneration | null
  /** True when the user stopped the last run. */
  generationStopped: boolean
  stopGeneration: () => void
  /** Extra formats from the last run (headlines, SMS, …). */
  extras: Partial<Record<ExtraFormat, string>>
  /** Every version of each channel from the last run; index 0 is the original pick. */
  versions: Partial<Record<keyof GeneratedBundle, string[]>>
  selectVersion: (channel: keyof GeneratedBundle, index: number) => void
  /** Load a finished result (e.g. from a batch run) into the workspace. */
  openResult: (property: PropertyData, settings: ContentSettings, result: StreamResult) => void
  setImagePreview: (url: string | null) => void
  setProperty: (p: PropertyData | ((prev: PropertyData) => PropertyData)) => void
  setSettings: (
    s: ContentSettings | ((prev: ContentSettings) => ContentSettings),
  ) => void
  loadSampleProperty: () => void
  runGeneration: () => Promise<void>
  setDrafts: (
    d: GeneratedBundle | ((prev: GeneratedBundle | null) => GeneratedBundle | null),
  ) => void
  applyImproveTone: (key: keyof GeneratedBundle) => Promise<void>
  applyPersuasive: (key: keyof GeneratedBundle) => Promise<void>
  applyShorten: (key: keyof GeneratedBundle) => Promise<void>
  applyImproveAll: () => Promise<void>
  applyPersuasiveAll: () => Promise<void>
  applyShortenAll: () => Promise<void>
  pushVersion: (label: string) => void
  clearGenerated: () => void
  finalizeEdits: (bundle: GeneratedBundle) => void
  /** Clears property, settings and results to start a fresh piece of content. */
  startNew: () => void
}
