import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { m } from 'motion/react'
import { useHydrated } from '../../hooks/useHydrated'
import './tabs.css'

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  /** Small trailing content, e.g. a marker or badge. */
  meta?: ReactNode
}

/**
 * WAI-ARIA tabs with automatic activation. Arrow keys move between tabs, Home/End jump
 * to the ends. Only the active panel is rendered.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  onChange,
  children,
}: {
  label: string
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  children: ReactNode
}) {
  const base = useId()
  const hydrated = useHydrated()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = (id: T) => `${base}-tab-${id}`
  const panelId = (id: T) => `${base}-panel-${id}`

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((i) => i.id === value)
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="tabs">
      <div className="tabs__list-wrap">
        <div
          className="tabs__list"
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) => {
            const selected = item.id === value
            return (
              <button
                key={item.id}
                ref={(el) => {
                  refs.current[i] = el
                }}
                type="button"
                role="tab"
                id={tabId(item.id)}
                aria-selected={selected}
                aria-controls={panelId(item.id)}
                tabIndex={selected ? 0 : -1}
                className={`tabs__tab ${selected ? 'tabs__tab--active' : ''}`.trim()}
                onClick={() => onChange(item.id)}
              >
                {item.label}
                {item.meta}
                {selected ? (
                  <m.span
                    className="tabs__indicator"
                    layoutId={`${base}-indicator`}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
      <div
        className="tabs__panel"
        role="tabpanel"
        id={panelId(value)}
        aria-labelledby={tabId(value)}
        tabIndex={0}
      >
        <m.div
          key={value}
          initial={hydrated ? { opacity: 0, y: 4 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </m.div>
      </div>
    </div>
  )
}
