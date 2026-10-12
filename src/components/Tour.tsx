import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { m } from 'motion/react'
import { X } from 'lucide-react'
import { markTourDone } from '../lib/tips-storage'
import { Button } from './ui/Button'
import './tour.css'

interface TourStep {
  /** Matches a [data-tour="…"] element; omitted for a centred card. */
  target?: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to REM Content Studio',
    body: 'A 30-second tour of where everything lives. You can skip it and reopen it any time from Learn.',
  },
  {
    target: 'nav-create',
    title: 'Create content',
    body: 'Four guided steps: property details, content settings, live generation, then review and export.',
  },
  {
    target: 'nav-batch',
    title: 'Batch',
    body: 'Writing for several properties? Add up to 20 — or paste them from a spreadsheet — and run them in one go.',
  },
  {
    target: 'nav-library',
    title: 'Library',
    body: 'Every run is saved here automatically, labelled with the engine that wrote it. Search, filter, reopen or export.',
  },
  {
    target: 'nav-learn',
    title: 'Learn',
    body: 'Short tutorials on writing strong property details, choosing a tone and reviewing AI output. Each step also has tips.',
  },
  {
    target: 'home-start',
    title: 'Ready when you are',
    body: 'Start your first listing here — or try the sample property to see all four channels written live.',
  },
]

const PAD = 6

/** First-run guided tour: spotlights sidebar items with an accessible popover. */
export function Tour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const titleId = useId()
  const bodyId = useId()
  const cardRef = useRef<HTMLDivElement>(null)
  const step = STEPS[index]
  const last = index === STEPS.length - 1

  const close = useCallback(() => {
    markTourDone()
    onClose()
  }, [onClose])

  // Measure the target after paint and whenever the layout moves.
  useEffect(() => {
    let frame = 0
    const measure = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null
      const visible = el && el.getClientRects().length > 0
      if (visible) el.scrollIntoView({ block: 'nearest' })
      setRect(visible ? el.getBoundingClientRect() : null)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [step.target])

  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
  }, [index])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1)
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
      if (e.key === 'Tab' && cardRef.current) {
        const nodes = [...cardRef.current.querySelectorAll<HTMLElement>('button')]
        const first = nodes[0]
        const lastNode = nodes[nodes.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          lastNode.focus()
        } else if (!e.shiftKey && document.activeElement === lastNode) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [close, index, last])

  // Place the card beside the target (right of the sidebar, or below), else centred.
  const cardStyle: CSSProperties = rect
    ? rect.left < window.innerWidth / 3
      ? { top: Math.max(16, Math.min(rect.top - 8, window.innerHeight - 260)), left: rect.right + 20 }
      : { top: Math.min(rect.bottom + 16, window.innerHeight - 260), left: Math.max(16, Math.min(rect.left, window.innerWidth - 376)) }
    : {}

  return createPortal(
    <div className={`tour ${rect ? '' : 'tour--center'}`.trim()}>
      {rect ? (
        <m.div
          className="tour__spotlight"
          aria-hidden
          initial={false}
          animate={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        />
      ) : (
        <div className="tour__backdrop" aria-hidden />
      )}
      <m.div
        ref={cardRef}
        key={index}
        className="tour__card"
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="tour__top">
          <span className="tour__count">
            {index + 1} of {STEPS.length}
          </span>
          <button type="button" className="tour__close" aria-label="Close tour" onClick={close}>
            <X aria-hidden />
          </button>
        </div>
        <h2 id={titleId} className="tour__title">
          {step.title}
        </h2>
        <p id={bodyId} className="tour__body">
          {step.body}
        </p>
        <div className="tour__dots" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.title} className={i === index ? 'is-active' : undefined} />
          ))}
        </div>
        <div className="tour__actions">
          {index === 0 ? (
            <Button variant="ghost" size="sm" onClick={close}>
              Skip tour
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            data-autofocus
            onClick={() => (last ? close() : setIndex((i) => i + 1))}
          >
            {last ? 'Finish' : index === 0 ? 'Show me' : 'Next'}
          </Button>
        </div>
      </m.div>
    </div>,
    document.body,
  )
}
