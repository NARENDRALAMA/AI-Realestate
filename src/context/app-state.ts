import type {
  ContentSettings,
  GeneratedBundle,
  PropertyData,
  VersionEntry,
} from '../types'

export interface AppState {
  property: PropertyData
  settings: ContentSettings
  generated: GeneratedBundle | null
  drafts: GeneratedBundle | null
  versionHistory: VersionEntry[]
  isGenerating: boolean
  generationError: string | null
  generationId: number | null
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
}
