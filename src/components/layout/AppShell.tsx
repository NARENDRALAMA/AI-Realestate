import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { m } from 'motion/react'
import {
  ArrowUpRight,
  BookOpen,
  Compass,
  GraduationCap,
  House,
  Layers,
  Info,
  ListOrdered,
  Menu,
  PenLine,
  type LucideIcon,
} from 'lucide-react'
import { useApp } from '../../hooks/useApp'
import { guideBySlug } from '../../content/guides'
import { prefetchAppPages } from '../../lib/app-pages'
import { startTour, TOUR_EVENT, tourDone } from '../../lib/tips-storage'
import { Tour } from '../Tour'
import { FLOW_PATHS, resumePath } from '../../lib/flow'
import { BrandMark } from '../BrandMark'
import { Dialog } from '../ui/Dialog'
import { RouteFallback } from './RouteFallback'
import './app-shell.css'

const TITLES: Record<string, string> = {
  '/app': 'Home',
  '/app/property': 'Property details',
  '/app/settings': 'Content settings',
  '/app/generated': 'Generated content',
  '/app/edit': 'Review & refine',
  '/app/export': 'Export',
  '/app/library': 'Library',
  '/app/workflow': 'How it works',
  '/app/about': 'About',
  '/app/batch': 'Batch generate',
  '/app/learn': 'Learn',
}

const titleFor = (path: string) =>
  TITLES[path] ?? (path.startsWith('/app/learn/') ? guideBySlug(path.slice(11))?.title : undefined)

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  isActive?: (path: string) => boolean
  end?: boolean
  tour?: string
}

function Brand() {
  return (
    <NavLink to="/app" className="brand" end>
      <BrandMark />
      <span className="brand__text">
        <span className="brand__name">REM Content Studio</span>
        <span className="brand__tag">Workspace</span>
      </span>
    </NavLink>
  )
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation()
  const { generated, isGenerating } = useApp()

  const primary: NavItem[] = [
    { label: 'Home', to: '/app', icon: House, end: true },
    {
      label: 'Create content',
      to: resumePath({ generated, isGenerating }),
      icon: PenLine,
      isActive: (p) => FLOW_PATHS.includes(p),
      tour: 'nav-create',
    },
    { label: 'Batch', to: '/app/batch', icon: Layers, tour: 'nav-batch' },
    { label: 'Library', to: '/app/library', icon: BookOpen, tour: 'nav-library' },
  ]
  const secondary: NavItem[] = [
    { label: 'Learn', to: '/app/learn', icon: GraduationCap, tour: 'nav-learn' },
    { label: 'How it works', to: '/app/workflow', icon: ListOrdered },
    { label: 'About', to: '/app/about', icon: Info },
  ]

  const renderItem = ({ label, to, icon: Icon, isActive, end, tour }: NavItem) => {
    const active = isActive ? isActive(pathname) : undefined
    return (
      <li key={label}>
        <NavLink
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive: routeActive }) =>
            `side-nav__link ${(active ?? routeActive) ? 'side-nav__link--active' : ''}`.trim()
          }
          aria-current={active === true ? 'page' : undefined}
          data-tour={onNavigate ? undefined : tour}
        >
          <Icon aria-hidden />
          {label}
        </NavLink>
      </li>
    )
  }

  return (
    <nav className="side-nav" aria-label="Main">
      <ul className="side-nav__list">{primary.map(renderItem)}</ul>
      <p className="side-nav__heading" id="nav-help-heading">
        Help
      </p>
      <ul className="side-nav__list" aria-labelledby="nav-help-heading">
        {secondary.map(renderItem)}
      </ul>
      <button
        type="button"
        className="side-nav__link side-nav__button"
        onClick={() => {
          onNavigate?.()
          startTour()
        }}
      >
        <Compass aria-hidden />
        Take the tour
      </button>
      <Link to="/" className="side-nav__site" onClick={onNavigate}>
        Back to website
        <ArrowUpRight aria-hidden />
      </Link>
    </nav>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // First visit to the workspace home opens the tour; Learn / the sidebar can reopen it.
  const [tourOpen, setTourOpen] = useState(() => pathname === '/app' && !tourDone())

  useEffect(() => {
    const open = () => setTourOpen(true)
    window.addEventListener(TOUR_EVENT, open)
    return () => window.removeEventListener(TOUR_EVENT, open)
  }, [])
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    prefetchAppPages()
  }, [])

  useEffect(() => {
    document.title = `${titleFor(pathname) ?? 'REM Content Studio'} · REM Content Studio`
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // Route change: start at the top and move focus to the new page for screen readers.
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar">
        <Brand />
        <SidebarNav />
      </aside>

      <header className="topbar">
        <Brand />
        <button
          type="button"
          className="topbar__menu"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu aria-hidden />
        </button>
      </header>

      <Dialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Menu"
        hideTitle
        placement="left"
      >
        <div className="drawer-nav">
          <Brand />
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </div>
      </Dialog>

      {tourOpen ? <Tour onClose={() => setTourOpen(false)} /> : null}

      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        <Suspense fallback={<RouteFallback />}>
          <m.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </m.div>
        </Suspense>
      </main>
    </div>
  )
}
