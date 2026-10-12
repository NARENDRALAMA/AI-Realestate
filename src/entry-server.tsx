/**
 * Build-time prerender of the landing page ("/") so it paints before any JavaScript runs.
 * Used only by scripts/prerender.mjs; the browser hydrates the same tree from main.tsx.
 */
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { AppProviders, AppRoutes } from './App'

export function render(url = '/') {
  return renderToString(
    <AppProviders>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </AppProviders>,
  )
}
