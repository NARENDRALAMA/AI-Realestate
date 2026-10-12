import { useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react'
import { m, useAnimationControls, useInView, type Variants } from 'motion/react'

const EASE = [0.22, 1, 0.36, 1] as const

const revealVariants = (delay = 0): Variants => ({
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay } },
})

const item = revealVariants()

/**
 * Scroll-reveal that is safe for prerendered HTML: content renders visible (no inline
 * `opacity: 0`), then after mount anything still below the fold is hidden before paint and
 * fades up when it scrolls into view. Content already on screen never flickers.
 */
function useReveal<T extends Element>(amount: number) {
  const ref = useRef<T>(null)
  const controls = useAnimationControls()
  const inView = useInView(ref, { once: true, amount })
  const armed = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top > window.innerHeight) {
      controls.set('hidden')
      armed.current = true
    }
  }, [controls])

  useEffect(() => {
    if (inView && armed.current) void controls.start('show')
  }, [inView, controls])

  return { ref, controls }
}

/** Fades content up once when it scrolls into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const { ref, controls } = useReveal<HTMLDivElement>(0.2)
  return (
    <m.div
      ref={ref}
      className={className}
      animate={controls}
      variants={revealVariants(delay)}
    >
      {children}
    </m.div>
  )
}

/** A list whose children (use <StaggerItem>) reveal one after another. */
export function Stagger({
  children,
  className,
  as = 'div',
  gap = 0.07,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'ul' | 'ol'
  gap?: number
}) {
  const { ref, controls } = useReveal<HTMLElement>(0.15)
  const variants: Variants = { hidden: {}, show: { transition: { staggerChildren: gap } } }
  if (as === 'ul')
    return <m.ul ref={ref as Ref<HTMLUListElement>} className={className} animate={controls} variants={variants}>{children}</m.ul>
  if (as === 'ol')
    return <m.ol ref={ref as Ref<HTMLOListElement>} className={className} animate={controls} variants={variants}>{children}</m.ol>
  return <m.div ref={ref as Ref<HTMLDivElement>} className={className} animate={controls} variants={variants}>{children}</m.div>
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  if (as === 'li')
    return (
      <m.li className={className} variants={item}>
        {children}
      </m.li>
    )
  return (
    <m.div className={className} variants={item}>
      {children}
    </m.div>
  )
}
