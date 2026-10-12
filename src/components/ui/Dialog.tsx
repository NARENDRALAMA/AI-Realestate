import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './Button'
import './dialog.css'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog. Traps focus, closes on Escape or backdrop click, locks page scroll and
 * returns focus to the element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement = 'center',
  hideTitle = false,
  initialFocusRef,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  placement?: 'center' | 'right' | 'left'
  hideTitle?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const target =
      initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE) ??
      panel
    target?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, initialFocusRef])

  if (!open) return null

  return createPortal(
    <div
      className={`dialog-backdrop dialog-backdrop--${placement}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={`dialog dialog--${placement}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className={`dialog__header ${hideTitle ? 'dialog__header--bare' : ''}`.trim()}>
          <div className="dialog__heading">
            <h2 id={titleId} className={hideTitle ? 'sr-only' : 'dialog__title'}>
              {title}
            </h2>
            {description ? (
              <p id={descId} className="dialog__desc">
                {description}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={<X aria-hidden />}
            aria-label="Close"
            onClick={onClose}
          />
        </div>
        {children ? <div className="dialog__body">{children}</div> : null}
        {footer ? <div className="dialog__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
