import type { GenerationMeta } from '../types'

/**
 * Interprets the backend's `model_used` field (see backend/orchestrator.py):
 *   "template"             → no AI output (LLM off, unreachable, or every channel fell back)
 *   "<model>"              → all four channels written by the model
 *   "<model> (partial)"    → some channels fell back to templates
 */
export function engineFromModelUsed(modelUsed: string | undefined | null, durationMs: number): GenerationMeta {
  if (!modelUsed || modelUsed === 'template') return { engine: 'template', durationMs }
  const partial = /\s*\(partial\)$/.test(modelUsed)
  return {
    engine: partial ? 'partial' : 'ai',
    model: modelUsed.replace(/\s*\(partial\)$/, ''),
    durationMs,
  }
}

/** Short human label, e.g. "AI · mistral", "Partly AI · mistral", "Template fallback". */
export const engineLabel = (meta: Pick<GenerationMeta, 'engine' | 'model'>) =>
  meta.engine === 'template'
    ? 'Template fallback'
    : `${meta.engine === 'partial' ? 'Partly AI' : 'AI'}${meta.model ? ` · ${meta.model}` : ''}`
