import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { getFlowSteps } from '../../lib/flow'
import { Breadcrumbs } from '../ui/Breadcrumbs'
import { Stepper } from '../ui/Stepper'

/** Wraps the four create steps with a shared progress stepper. */
export function FlowLayout() {
  const { pathname } = useLocation()
  const { property, generated, drafts, isGenerating, generationError } = useApp()
  const steps = getFlowSteps(pathname, {
    property,
    generated,
    drafts,
    isGenerating,
    generationError,
  })

  const current = steps.find((s) => s.status === 'current')

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/app' },
          { label: 'Create content', to: '/app/property' },
          { label: current?.label ?? 'Property details' },
        ]}
      />
      <Stepper steps={steps} />
      <Outlet />
    </div>
  )
}
