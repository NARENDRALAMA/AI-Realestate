import { FileText, Mail, Share2, Video, type LucideIcon } from 'lucide-react'
import type { ContentType } from '../types'

const icons: Record<ContentType, LucideIcon> = {
  listing: FileText,
  social: Share2,
  email: Mail,
  video: Video,
}

const TINTS = ['tint-1', 'tint-2', 'tint-3', 'tint-4', 'tint-5', 'tint-6']

const initials = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !/^\d+$/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '•'

/**
 * Typographic thumbnail for a library item. The API doesn't return photos, so this uses
 * the title's initials on a tint derived from the title, with the focus channel's icon.
 */
export function ThumbTile({ title, type }: { title: string; type: string }) {
  const Icon = icons[type as ContentType] ?? FileText
  const hash = [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return (
    <span className={`thumb ${TINTS[hash % TINTS.length]}`} aria-hidden>
      <span className="thumb__initials">{initials(title)}</span>
      <span className="thumb__badge">
        <Icon />
      </span>
    </span>
  )
}
