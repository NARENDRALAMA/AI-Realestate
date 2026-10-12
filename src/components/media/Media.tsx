import type { ReactNode } from 'react'
import { photos, SCREEN_SIZE, screens, type PhotoName, type ScreenName } from '../../lib/images'
import './media.css'

/**
 * Responsive photo from public/images. Lazy by default; pass `priority` for the one
 * image that is visible on first paint.
 */
export function Photo({
  name,
  sizes = '100vw',
  priority = false,
  className,
  alt,
}: {
  name: PhotoName
  sizes?: string
  priority?: boolean
  className?: string
  /** Overrides the default description when the photo plays a different role. */
  alt?: string
}) {
  const p = photos[name]
  const largest = p.widths[p.widths.length - 1]
  return (
    <img
      className={className}
      src={`/images/${name}-${largest}.webp`}
      srcSet={p.widths.map((w) => `/images/${name}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      width={p.w}
      height={p.h}
      alt={alt ?? p.alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      {...(priority ? { fetchPriority: 'high' as const } : {})}
    />
  )
}

/** A screenshot of our own app inside a minimal browser frame. */
export function BrowserFrame({
  screen,
  sizes = '(min-width: 64rem) 50vw, 100vw',
  url = 'REM Content Studio',
  caption,
}: {
  screen: ScreenName
  sizes?: string
  url?: string
  caption?: ReactNode
}) {
  return (
    <figure className="browser-frame">
      <div className="browser-frame__bar" aria-hidden>
        <span className="browser-frame__dots">
          <span />
          <span />
          <span />
        </span>
        <span className="browser-frame__url">{url}</span>
      </div>
      <img
        className="browser-frame__img"
        src={`/images/screens/${screen}-1280.webp`}
        srcSet={SCREEN_SIZE.widths.map((w) => `/images/screens/${screen}-${w}.webp ${w}w`).join(', ')}
        sizes={sizes}
        width={SCREEN_SIZE.w}
        height={SCREEN_SIZE.h}
        alt={screens[screen].alt}
        loading="lazy"
        decoding="async"
      />
      {caption ? <figcaption className="browser-frame__caption">{caption}</figcaption> : null}
    </figure>
  )
}
