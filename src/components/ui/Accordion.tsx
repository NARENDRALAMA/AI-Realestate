import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Plus } from 'lucide-react'
import './accordion.css'

export interface AccordionItem {
  id: string
  question: string
  answer: ReactNode
}

/** Disclosure list: each header is a button with aria-expanded controlling a labelled region. */
export function Accordion({ items, headingLevel = 3 }: { items: AccordionItem[]; headingLevel?: 2 | 3 }) {
  const base = useId()
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null)
  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div className="accordion">
      {items.map((item) => {
        const isOpen = open === item.id
        const btnId = `${base}-btn-${item.id}`
        const panelId = `${base}-panel-${item.id}`
        return (
          <div key={item.id} className={`accordion__item ${isOpen ? 'accordion__item--open' : ''}`.trim()}>
            <Heading className="accordion__heading">
              <button
                id={btnId}
                type="button"
                className="accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : item.id)}
              >
                <span>{item.question}</span>
                <Plus className="accordion__icon" aria-hidden />
              </button>
            </Heading>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <m.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="accordion__panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="accordion__content">{item.answer}</div>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
