import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppProvider'
import { Layout } from './components/Layout'
import { About } from './pages/About'
import { ContentSettings } from './pages/ContentSettings'
import { EditReview } from './pages/EditReview'
import { Export } from './pages/Export'
import { GeneratedContent } from './pages/GeneratedContent'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { PropertyInput } from './pages/PropertyInput'
import { Workflow } from './pages/Workflow'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="property" element={<PropertyInput />} />
            <Route path="settings" element={<ContentSettings />} />
            <Route path="generated" element={<GeneratedContent />} />
            <Route path="edit" element={<EditReview />} />
            <Route path="export" element={<Export />} />
            <Route path="library" element={<Library />} />
            <Route path="workflow" element={<Workflow />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
