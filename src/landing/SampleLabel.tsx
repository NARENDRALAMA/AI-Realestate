import { FlaskConical } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { sampleEngine } from '../data/sample-outputs'
import { engineFromModelUsed, engineLabel } from '../lib/engine'
import type { Tone } from '../types'

/**
 * Marks content as real, unedited output from the sample property — never a testimonial —
 * and says which engine actually wrote it.
 */
export function SampleLabel({ tone }: { tone: Tone }) {
  const engine = engineLabel(engineFromModelUsed(sampleEngine[tone], 0))
  return (
    <Badge tone="accent" icon={<FlaskConical aria-hidden />}>
      Sample output · {engine} · unedited
    </Badge>
  )
}
