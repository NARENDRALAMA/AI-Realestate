import type { StepperStep } from '../components/ui/Stepper'
import type { GeneratedBundle, PropertyData } from '../types'
import { isPropertyValid } from './validation'

export const FLOW_PATHS = ['/app/property', '/app/settings', '/app/generated', '/app/edit', '/app/export']

const STEP_FOR_PATH: Record<string, number> = {
  '/app/property': 0,
  '/app/settings': 1,
  '/app/generated': 2,
  '/app/edit': 3,
  '/app/export': 3,
}

/** Builds the stepper state for the four-step create flow from the app state. */
export function getFlowSteps(
  pathname: string,
  state: {
    property: PropertyData
    generated: GeneratedBundle | null
    drafts: GeneratedBundle | null
    isGenerating: boolean
    generationError: string | null
  },
): StepperStep[] {
  const current = STEP_FOR_PATH[pathname] ?? 0
  const propertyOk = isPropertyValid(state.property)
  const hasResult = !!state.generated

  const base = [
    { id: 'property', label: 'Property details', to: '/app/property', done: propertyOk },
    {
      id: 'settings',
      label: 'Content settings',
      to: '/app/settings',
      done: hasResult,
      disabledReason: propertyOk ? undefined : 'Add a title and location first',
    },
    {
      id: 'generate',
      label: 'Generate',
      to: '/app/generated',
      done: hasResult,
      disabledReason:
        hasResult || state.isGenerating || state.generationError
          ? undefined
          : 'Choose your settings and generate first',
    },
    {
      id: 'review',
      label: 'Review & export',
      to: '/app/edit',
      done: false,
      disabledReason: state.drafts ? undefined : 'Generate content first',
    },
  ]

  return base.map((s, i) => ({
    id: s.id,
    label: s.label,
    to: s.to,
    disabledReason: i === current ? undefined : s.disabledReason,
    status: i === current ? 'current' : s.done && !s.disabledReason ? 'complete' : 'upcoming',
  }))
}

/** Where "Create content" should take the user: resume if there's work in progress. */
export function resumePath(state: { generated: GeneratedBundle | null; isGenerating: boolean }) {
  return state.generated || state.isGenerating ? '/app/generated' : '/app/property'
}
