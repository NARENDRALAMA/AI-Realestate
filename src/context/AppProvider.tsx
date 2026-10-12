import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { sampleProperty } from '../data/sampleProperty'
import {
  ApiError,
  fetchLibraryItem,
  generateContent,
  generateContentStream,
  propertyFromStored,
  refineContent,
  StreamUnsupportedError,
  updateLibraryItem,
  type StreamEvent,
  type StreamResult,
} from '../lib/api'
import { CHANNELS } from '../lib/content-options'
import { getToken } from '../lib/auth'
import { engineFromModelUsed } from '../lib/engine'
import type {
  ContentSettings,
  ExtraFormat,
  GeneratedBundle,
  GenerationMeta,
  PropertyData,
  VersionEntry,
} from '../types'
import {
  defaultSettings,
  emptyProperty,
} from '../types'
import { AppContext } from './app-context'
import type { LiveGeneration, SaveState } from './app-state'

// The current property, settings and result id survive a page reload (this tab only).
const WORKSPACE_KEY = 'rem.workspace'

interface SavedWorkspace {
  property: PropertyData
  settings: ContentSettings
  generationId: number | null
}

function readWorkspace(): SavedWorkspace | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(WORKSPACE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedWorkspace
    return {
      property: { ...emptyProperty(), ...saved.property, imageFileName: null },
      settings: { ...defaultSettings(), ...saved.settings },
      generationId: saved.generationId ?? null,
    }
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(readWorkspace)
  const [property, setProperty] = useState<PropertyData>(() => restored?.property ?? emptyProperty())
  const [settings, setSettings] = useState<ContentSettings>(() => restored?.settings ?? defaultSettings())
  const [generated, setGenerated] = useState<GeneratedBundle | null>(null)
  const [drafts, setDrafts] = useState<GeneratedBundle | null>(null)
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [generationId, setGenerationId] = useState<number | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // JSON of the copy last stored on the server, so unchanged drafts aren't re-saved.
  const savedRef = useRef<string | null>(null)
  const [generationFieldErrors, setGenerationFieldErrors] = useState<Record<string, string>>({})
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [generationMeta, setGenerationMeta] = useState<GenerationMeta | null>(null)
  const [imagePreview, setImagePreviewState] = useState<string | null>(null)
  const [live, setLive] = useState<LiveGeneration | null>(null)
  const [generationStopped, setGenerationStopped] = useState(false)
  const [extras, setExtras] = useState<Partial<Record<ExtraFormat, string>>>({})
  const [versions, setVersions] = useState<Partial<Record<keyof GeneratedBundle, string[]>>>({})
  const abortRef = useRef<AbortController | null>(null)
  // Text chunks arrive many times a second; buffer them and paint once per frame.
  const pendingRef = useRef(new Map<string, string>())
  const frameRef = useRef<number | null>(null)

  const flushPending = useCallback(() => {
    frameRef.current = null
    const pending = pendingRef.current
    if (pending.size === 0) return
    const chunks = new Map(pending)
    pending.clear()
    setLive((l) => {
      if (!l) return l
      const byJob = { ...l.byJob }
      for (const [job, text] of chunks) {
        const prev = byJob[job]
        if (!prev || prev.status === 'done') continue
        byJob[job] = { text: prev.text + text, status: 'writing' }
      }
      return { ...l, byJob }
    })
  }, [])

  const handleStreamEvent = useCallback(
    (event: StreamEvent, variations: number) => {
      if (event.type === 'start') {
        setLive({
          engine: event.engine,
          model: event.model,
          jobs: event.jobs,
          variations,
          byJob: Object.fromEntries(event.jobs.map((j) => [j, { text: '', status: 'waiting' as const }])),
        })
      } else if (event.type === 'delta') {
        const pending = pendingRef.current
        pending.set(event.job, (pending.get(event.job) ?? '') + event.text)
        if (frameRef.current === null) frameRef.current = requestAnimationFrame(flushPending)
      } else if (event.type === 'job_done') {
        pendingRef.current.delete(event.job)
        setLive((l) =>
          l
            ? {
                ...l,
                byJob: { ...l.byJob, [event.job]: { text: event.text, status: 'done', source: event.source } },
              }
            : l,
        )
      }
    },
    [flushPending],
  )

  const applyResult = useCallback((result: StreamResult, fallbackMs: number) => {
    const bundle = result.bundle
    setGenerationMeta(
      engineFromModelUsed(result.model_used, result.generation_time_ms ?? fallbackMs, result.channel_sources),
    )
    setGenerationId(result.id)
    savedRef.current = JSON.stringify(bundle)
    setSaveState('idle')
    setGenerated(bundle)
    setDrafts(bundle)
    setExtras(result.extras ?? {})
    setVersions(
      Object.fromEntries(
        CHANNELS.map((c) => [c, [bundle[c], ...(result.variants?.[c] ?? [])]]),
      ) as Partial<Record<keyof GeneratedBundle, string[]>>,
    )
  }, [])

  // Revoke the previous object URL whenever the preview is replaced or cleared.
  const setImagePreview = useCallback((url: string | null) => {
    setImagePreviewState((prev) => {
      if (prev && prev !== url) URL.revokeObjectURL(prev)
      return url
    })
  }, [])

  const loadSampleProperty = useCallback(() => {
    setProperty({ ...sampleProperty })
  }, [])

  const runGeneration = useCallback(async () => {
    const startedAt = Date.now()
    const controller = new AbortController()
    abortRef.current = controller
    pendingRef.current.clear()
    setLive(null)
    setIsGenerating(true)
    setGenerationStopped(false)
    setGenerationError(null)
    setGenerationFieldErrors({})
    setGenerationStartedAt(startedAt)
    try {
      let result: StreamResult
      try {
        result = await generateContentStream(
          property,
          settings,
          (event) => handleStreamEvent(event, settings.variations),
          controller.signal,
        )
      } catch (err) {
        if (!(err instanceof StreamUnsupportedError)) throw err
        // Older servers have no streaming endpoint: fall back to the one-shot API.
        result = { ...(await generateContent(property, settings)), variants: {}, extras: {} }
      }
      applyResult(result, Date.now() - startedAt)
      setVersionHistory((h) => [
        {
          id: crypto.randomUUID(),
          label: 'Initial generation',
          at: new Date().toLocaleString(),
        },
        ...h,
      ])
    } catch (err) {
      if (controller.signal.aborted) {
        setGenerationStopped(true)
      } else {
        const msg = err instanceof Error ? err.message : "Couldn't generate content"
        setGenerationError(msg)
        if (err instanceof ApiError) setGenerationFieldErrors(err.fieldErrors)
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setIsGenerating(false)
      setGenerationStartedAt(null)
    }
  }, [property, settings, handleStreamEvent, applyResult])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const selectVersion = useCallback(
    (channel: keyof GeneratedBundle, index: number) => {
      const text = versions[channel]?.[index]
      if (text === undefined) return
      setDrafts((d) => (d ? { ...d, [channel]: text } : d))
    },
    [versions],
  )

  const openResult = useCallback(
    (p: PropertyData, s: ContentSettings, result: StreamResult) => {
      setProperty({ ...p })
      setSettings({ ...s })
      setLive(null)
      setGenerationError(null)
      setGenerationStopped(false)
      applyResult(result, result.generation_time_ms)
      setVersionHistory([
        { id: crypto.randomUUID(), label: 'Opened saved content', at: new Date().toLocaleString() },
      ])
    },
    [applyResult],
  )

  const clearGenerated = useCallback(() => {
    savedRef.current = null
    setSaveState('idle')
    setGenerated(null)
    setDrafts(null)
    setGenerationError(null)
    setGenerationFieldErrors({})
    setGenerationId(null)
    setGenerationMeta(null)
    setGenerationStopped(false)
    setLive(null)
    setExtras({})
    setVersions({})
  }, [])

  const startNew = useCallback(() => {
    setProperty(emptyProperty())
    setSettings(defaultSettings())
    setVersionHistory([])
    setImagePreview(null)
    clearGenerated()
  }, [clearGenerated, setImagePreview])

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

  // Remember the workspace for this tab so a reload doesn't lose it.
  useEffect(() => {
    try {
      const { imageFileName: _file, ...rest } = property
      void _file
      sessionStorage.setItem(
        WORKSPACE_KEY,
        JSON.stringify({ property: rest, settings, generationId }),
      )
    } catch {
      // storage unavailable: nothing to restore later
    }
  }, [property, settings, generationId])

  // After a reload, reopen the last result from the library (including saved edits).
  const restoreId = restored?.generationId ?? null
  useEffect(() => {
    if (restoreId === null || !getToken()) return
    let cancelled = false
    fetchLibraryItem(restoreId)
      .then((d) => {
        if (cancelled) return
        setGenerated((g) => g ?? d.bundle)
        setDrafts((cur) => cur ?? d.bundle)
        setGenerationId((id) => id ?? d.id)
        setGenerationMeta((m) => m ?? engineFromModelUsed(d.model_used, d.generation_time_ms, d.channel_sources))
        setExtras((e) => (Object.keys(e).length ? e : d.extras ?? {}))
        setVersions((v) =>
          Object.keys(v).length
            ? v
            : (Object.fromEntries(CHANNELS.map((c) => [c, [d.bundle[c], ...(d.variants?.[c] ?? [])]])) as Partial<
                Record<keyof GeneratedBundle, string[]>
              >),
        )
        setProperty((p) => (p.title ? p : propertyFromStored(d.property)))
        savedRef.current = JSON.stringify(d.bundle)
      })
      .catch(() => undefined) // deleted or not ours: start fresh
    return () => {
      cancelled = true
    }
  }, [restoreId])

  // Save edits back to the library shortly after the user stops typing.
  useEffect(() => {
    if (!drafts || generationId === null || isGenerating) return
    const json = JSON.stringify(drafts)
    if (json === savedRef.current) return
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      updateLibraryItem(generationId, drafts, extras)
        .then(() => {
          savedRef.current = json
          setSaveState('saved')
        })
        .catch(() => setSaveState('error'))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [drafts, extras, generationId, isGenerating])

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
      saveState,
      generationFieldErrors,
      generationStartedAt,
      generationMeta,
      imagePreview,
      setImagePreview,
      live,
      generationStopped,
      stopGeneration,
      extras,
      versions,
      selectVersion,
      openResult,
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
      startNew,
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
      saveState,
      generationFieldErrors,
      generationStartedAt,
      generationMeta,
      imagePreview,
      setImagePreview,
      live,
      generationStopped,
      stopGeneration,
      extras,
      versions,
      selectVersion,
      openResult,
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
      startNew,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
