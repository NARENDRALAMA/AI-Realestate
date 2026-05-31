import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>
          REM Content Studio — structured inputs, channel-ready copy, tone control
          for real estate marketing teams.
        </p>
      </footer>
    </div>
  )
}
