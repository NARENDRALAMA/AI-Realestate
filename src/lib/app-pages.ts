/**
 * Code-split loaders for the app routes. Kept in one place so the shell can prefetch
 * every page once the app has opened — navigating to Generate must never wait on a
 * network round-trip for code (that would look like a frozen screen on slow connections).
 */
export const pageLoaders = {
  AppShell: () => import('../components/layout/AppShell'),
  FlowLayout: () => import('../components/layout/FlowLayout'),
  Home: () => import('../pages/Home'),
  PropertyInput: () => import('../pages/PropertyInput'),
  ContentSettings: () => import('../pages/ContentSettings'),
  GeneratedContent: () => import('../pages/GeneratedContent'),
  EditReview: () => import('../pages/EditReview'),
  Export: () => import('../pages/Export'),
  Library: () => import('../pages/Library'),
  Workflow: () => import('../pages/Workflow'),
  About: () => import('../pages/About'),
  Batch: () => import('../pages/Batch'),
  Learn: () => import('../pages/Learn'),
  PublicGuides: () => import('../pages/public/Guides'),
}

let prefetched = false

/** Warms every app chunk once, when the browser is idle. */
export function prefetchAppPages() {
  if (prefetched) return
  prefetched = true
  const run = () => Object.values(pageLoaders).forEach((load) => void load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2000 })
  else setTimeout(run, 500)
}
