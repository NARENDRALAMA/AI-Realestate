import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, Menu } from 'lucide-react'
import { LinkButton } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { BrandMark } from '../components/BrandMark'

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#channels', label: 'Channels' },
  { href: '#tones', label: 'Tones' },
  { href: '#reliability', label: 'Reliability' },
  { href: '#faq', label: 'FAQ' },
]

/** Sticky, translucent site navigation that firms up once the page scrolls. */
export function SiteNav() {
  const { pathname } = useLocation()
  // Section links point at the landing page when shown on other public pages (e.g. /guides).
  const prefix = pathname === '/' ? '' : '/'
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`site-nav ${scrolled ? 'site-nav--scrolled' : ''}`.trim()}>
      <div className="site-nav__inner">
        <Link to="/" className="site-brand" aria-label="REM Content Studio home">
          <BrandMark />
          <span className="site-brand__name">REM Content Studio</span>
        </Link>

        <nav className="site-nav__links" aria-label="Page sections">
          {links.map((l) => (
            <a key={l.href} href={prefix + l.href}>
              {l.label}
            </a>
          ))}
          <Link to="/guides" aria-current={pathname.startsWith('/guides') ? 'page' : undefined}>
            Guides
          </Link>
        </nav>

        <div className="site-nav__actions">
          <LinkButton to="/app" variant="primary" iconAfter={<ArrowRight aria-hidden />}>
            Launch app
          </LinkButton>
          <button
            type="button"
            className="site-nav__menu"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Menu" hideTitle placement="right">
        <nav className="site-nav__drawer" aria-label="Page sections">
          {links.map((l) => (
            <a key={l.href} href={prefix + l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/guides" onClick={() => setOpen(false)}>
            Guides
          </Link>
          <LinkButton to="/app" variant="primary" size="lg" block iconAfter={<ArrowRight aria-hidden />}>
            Launch app
          </LinkButton>
        </nav>
      </Dialog>
    </header>
  )
}
