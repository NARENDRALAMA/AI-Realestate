import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { domAnimation, LazyMotion, MotionConfig } from 'motion/react'
import { AppProvider } from './context/AppProvider'
import { ToastProvider } from './components/ui/Toast'
import { RouteFallback } from './components/layout/RouteFallback'
import { LandingPage } from './landing/LandingPage'
import { pageLoaders } from './lib/app-pages'

// The marketing page loads eagerly; the app is split into its own chunks.
const named = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => loader().then((mod) => ({ default: mod[name] })))

const AppShell = named(pageLoaders.AppShell, 'AppShell')
const FlowLayout = named(pageLoaders.FlowLayout, 'FlowLayout')
const Home = named(pageLoaders.Home, 'Home')
const PropertyInput = named(pageLoaders.PropertyInput, 'PropertyInput')
const ContentSettings = named(pageLoaders.ContentSettings, 'ContentSettings')
const GeneratedContent = named(pageLoaders.GeneratedContent, 'GeneratedContent')
const EditReview = named(pageLoaders.EditReview, 'EditReview')
const Export = named(pageLoaders.Export, 'Export')
const Library = named(pageLoaders.Library, 'Library')
const Workflow = named(pageLoaders.Workflow, 'Workflow')
const About = named(pageLoaders.About, 'About')
const Batch = named(pageLoaders.Batch, 'Batch')
const Learn = named(pageLoaders.Learn, 'Learn')
const LearnGuide = named(pageLoaders.Learn, 'LearnGuide')
const GuidesIndex = named(pageLoaders.PublicGuides, 'GuidesIndex')
const GuideDetail = named(pageLoaders.PublicGuides, 'GuideDetail')

const LEGACY = ['property', 'settings', 'generated', 'edit', 'export', 'library', 'workflow', 'about']

/** Old top-level URLs (e.g. /property) now live under /app. Keeps any query string. */
function LegacyRedirect() {
  const { pathname, search } = useLocation()
  return <Navigate to={`/app${pathname}${search}`} replace />
}

/** Everything above the router. Shared by the browser entry and the landing-page prerender. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <AppProvider>
          <ToastProvider>{children}</ToastProvider>
        </AppProvider>
      </LazyMotion>
    </MotionConfig>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="guides" element={<GuidesIndex />} />
        <Route path="guides/:slug" element={<GuideDetail />} />
        <Route path="app" element={<AppShell />}>
          <Route index element={<Home />} />
          <Route element={<FlowLayout />}>
            <Route path="property" element={<PropertyInput />} />
            <Route path="settings" element={<ContentSettings />} />
            <Route path="generated" element={<GeneratedContent />} />
            <Route path="edit" element={<EditReview />} />
            <Route path="export" element={<Export />} />
          </Route>
          <Route path="library" element={<Library />} />
          <Route path="batch" element={<Batch />} />
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:slug" element={<LearnGuide />} />
          <Route path="workflow" element={<Workflow />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        {LEGACY.map((p) => (
          <Route key={p} path={p} element={<LegacyRedirect />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  )
}
