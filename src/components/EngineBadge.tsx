import { Clock, Cpu, Sparkles, SplitSquareHorizontal, type LucideIcon } from 'lucide-react'
import type { GenerationMeta } from '../types'
import { engineLabel } from '../lib/engine'
import { formatDuration } from '../lib/format'
import { Badge, type BadgeTone } from './ui/Badge'
import { InfoTooltip } from './ui/Tooltip'

const engines: Record<
  GenerationMeta['engine'],
  { tone: BadgeTone; icon: LucideIcon; short: string; help: (model?: string) => string }
> = {
  ai: {
    tone: 'primary',
    icon: Sparkles,
    short: 'AI',
    help: (model) =>
      `Written by ${model ?? 'the AI model'} from grounded prompts: it was given only the details you entered and told never to invent facts. AI can still make mistakes, so review before publishing.`,
  },
  partial: {
    tone: 'warning',
    icon: SplitSquareHorizontal,
    short: 'Partly AI',
    help: (model) =>
      `${model ?? 'The AI model'} wrote some channels. The others took too long or failed, so they were built from templates instead. Regenerate to try the AI again for all four.`,
  },
  template: {
    tone: 'neutral',
    icon: Cpu,
    short: 'Template fallback',
    help: () =>
      "The AI model wasn't used for this run — it's switched off on the server, unreachable, or didn't answer in time — so all four channels were built from templates using your details. Template copy can include general lifestyle lines, so check them. Regenerate to try the AI again.",
  },
}

/** Compact engine badge (library rows, detail panel). */
export function EngineChip({ meta }: { meta: GenerationMeta }) {
  const engine = engines[meta.engine]
  const Icon = engine.icon
  return (
    <Badge tone={engine.tone} icon={<Icon aria-hidden />}>
      {engineLabel(meta)}
    </Badge>
  )
}

/** Engine badge with an explanatory tooltip, plus the server-side generation time. */
export function EngineBadge({ meta }: { meta: GenerationMeta }) {
  const engine = engines[meta.engine]
  return (
    <span className="engine-meta">
      <span className="engine-meta__item">
        <EngineChip meta={meta} />
        <InfoTooltip label={`What does "${engine.short}" mean?`}>{engine.help(meta.model)}</InfoTooltip>
      </span>
      <span className="engine-meta__time">
        <Clock aria-hidden />
        Generated in {formatDuration(meta.durationMs)}
      </span>
    </span>
  )
}
