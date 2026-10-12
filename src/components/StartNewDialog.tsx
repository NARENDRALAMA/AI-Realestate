import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'

/** Confirms clearing the workspace before starting a new piece of content. */
export function StartNewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startNew } = useApp()
  const navigate = useNavigate()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start new content?"
      description="This clears the current property and copy from your workspace. Anything you generated stays saved in your library."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose()
              startNew()
              navigate('/app/property')
            }}
          >
            Start new
          </Button>
        </>
      }
    />
  )
}
