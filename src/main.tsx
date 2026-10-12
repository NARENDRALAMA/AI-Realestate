import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/newsreader/wght.css'
import '@fontsource-variable/newsreader/wght-italic.css'
import './index.css'
import App from './App.tsx'

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// The production build prerenders the landing page into index.html. Hydrate it on "/";
// every other route (served the same file by the SPA fallback) starts from a clean root.
if (location.pathname === '/' && container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  container.textContent = ''
  document.documentElement.removeAttribute('data-spa')
  createRoot(container).render(app)
}
