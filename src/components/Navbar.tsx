import { NavLink } from 'react-router-dom'
import { BookOpen, Building2, Home, Info, Layers, Sparkles } from 'lucide-react'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `nav-link ${isActive ? 'nav-link--active' : ''}`.trim()

export function Navbar() {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <NavLink to="/" className="brand" end>
          <span className="brand__icon" aria-hidden>
            <Building2 size={22} strokeWidth={2} />
          </span>
          <span className="brand__text">
            <span className="brand__title">REM Content Studio</span>
            <span className="brand__sub">AI real estate marketing content</span>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Primary">
          <NavLink to="/" className={linkClass} end>
            <Home size={16} aria-hidden />
            Home
          </NavLink>
          <NavLink to="/property" className={linkClass}>
            <Layers size={16} aria-hidden />
            Property
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <Sparkles size={16} aria-hidden />
            Settings
          </NavLink>
          <NavLink to="/generated" className={linkClass}>
            Output
          </NavLink>
          <NavLink to="/edit" className={linkClass}>
            Review
          </NavLink>
          <NavLink to="/export" className={linkClass}>
            Export
          </NavLink>
          <NavLink to="/library" className={linkClass}>
            <BookOpen size={16} aria-hidden />
            Library
          </NavLink>
          <NavLink to="/workflow" className={linkClass}>
            Workflow
          </NavLink>
          <NavLink to="/about" className={linkClass}>
            <Info size={16} aria-hidden />
            About
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
