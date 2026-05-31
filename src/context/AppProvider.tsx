import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { sampleProperty } from '../data/sampleProperty'
import { generateContent, refineContent } from '../lib/api'
import type {
  ContentSettings,
  GeneratedBundle,
  PropertyData,
  VersionEntry,
} from '../types'
import {
  defaultSettings,
  emptyProperty,
} from '../types'
import { AppContext } from './app-context'

const CHANNELS: (keyof GeneratedBundle)[] = ['listing', 'social', 'email', 'video']

export function AppProvider({ children }: { children: ReactNode }) {
  const [property, setProperty] = useState<PropertyData>(emptyProperty())
  const [settings, setSettings] = useState<ContentSettings>(defaultSettings())
  const [generated, setGenerated] = useState<GeneratedBundle | null>(null)
  const [drafts, setDrafts] = useState<GeneratedBundle | null>(null)
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationId, setGenerationId] = useState<number | null>(null)

  const loadSampleProperty = useCallback(() => {
    setProperty({ ...sampleProperty })
  }, [])

  const runGeneration = useCallback(async () => {
    setIsGenerating(true)
    setGenerationError(null)
    try {
      const result = await generateContent(property, settings)
      const bundle = result.bundle
      setGenerationId(result.id)
      setGenerated(bundle)
      setDrafts(bundle)
      setVersionHistory((h) => [
        {
          id: crypto.randomUUID(),
          label: 'Initial generation',
          at: new Date().toLocaleString(),
        },
        ...h,
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setGenerationError(msg)
    } finally {
      setIsGenerating(false)
    }
  }, [property, settings])

  const clearGenerated = useCallback(() => {
    setGenerated(null)
    setDrafts(null)
    setGenerationError(null)
    setGenerationId(null)
  }, [])

  const finalizeEdits = useCallback((bundle: GeneratedBundle) => {
    setGenerated({ ...bundle })
    setVersionHistory((h) => [
      {
        id: crypto.randomUUID(),
        label: 'Finalized for export',
        at: new Date().toLocaleString(),
      },
      ...h,
    ])
  }, [])

  const pushVersion = useCallback((label: string) => {
    setVersionHistory((h) => [
      {
        id: crypto.randomUUID(),
        label,
        at: new Date().toLocaleString(),
      },
      ...h,
    ])
  }, [])

  const applyImproveTone = useCallback(
    async (key: keyof GeneratedBundle) => {
      if (!drafts) return
      const refined = await refineContent('tone', key, drafts[key], property, settings)
      setDrafts((d) => d ? { ...d, [key]: refined } : d)
      pushVersion(`Improve tone · ${key}`)
    },
    [drafts, property, settings, pushVersion],
  )

  const applyPersuasive = useCallback(
    async (key: keyof GeneratedBundle) => {
      if (!drafts) return
      const refined = await refineContent('persuasive', key, drafts[key], property, settings)
      setDrafts((d) => d ? { ...d, [key]: refined } : d)
      pushVersion(`More persuasive · ${key}`)
    },
    [drafts, property, settings, pushVersion],
  )

  const applyShorten = useCallback(
    async (key: keyof GeneratedBundle) => {
      if (!drafts) return
      const refined = await refineContent('shorten', key, drafts[key], property, settings)
      setDrafts((d) => d ? { ...d, [key]: refined } : d)
      pushVersion(`Shorten · ${key}`)
    },
    [drafts, property, settings, pushVersion],
  )

  const applyImproveAll = useCallback(async () => {
    if (!drafts) return
    const results = await Promise.all(
      CHANNELS.map((ch) => refineContent('tone', ch, drafts[ch], property, settings)),
    )
    setDrafts({ listing: results[0], social: results[1], email: results[2], video: results[3] })
    pushVersion('Improve tone · all channels')
  }, [drafts, property, settings, pushVersion])

  const applyPersuasiveAll = useCallback(async () => {
    if (!drafts) return
    const results = await Promise.all(
      CHANNELS.map((ch) => refineContent('persuasive', ch, drafts[ch], property, settings)),
    )
    setDrafts({ listing: results[0], social: results[1], email: results[2], video: results[3] })
    pushVersion('More persuasive · all channels')
  }, [drafts, property, settings, pushVersion])

  const applyShortenAll = useCallback(async () => {
    if (!drafts) return
    const results = await Promise.all(
      CHANNELS.map((ch) => refineContent('shorten', ch, drafts[ch], property, settings)),
    )
    setDrafts({ listing: results[0], social: results[1], email: results[2], video: results[3] })
    pushVersion('Shorten · all channels')
  }, [drafts, property, settings, pushVersion])

  const value = useMemo(
    () => ({
      property,
      settings,
      generated,
      drafts,
      versionHistory,
      isGenerating,
      generationError,
      generationId,
      setProperty,
      setSettings,
      loadSampleProperty,
      runGeneration,
      setDrafts,
      applyImproveTone,
      applyPersuasive,
      applyShorten,
      applyImproveAll,
      applyPersuasiveAll,
      applyShortenAll,
      pushVersion,
      clearGenerated,
      finalizeEdits,
    }),
    [
      property,
      settings,
      generated,
      drafts,
      versionHistory,
      isGenerating,
      generationError,
      generationId,
      loadSampleProperty,
      runGeneration,
      applyImproveTone,
      applyPersuasive,
      applyShorten,
      applyImproveAll,
      applyPersuasiveAll,
      applyShortenAll,
      pushVersion,
      clearGenerated,
      finalizeEdits,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
