import { useEffect } from 'react'
import { ChannelShowcase } from './ChannelShowcase'
import { ExportSection } from './ExportSection'
import { Faq } from './Faq'
import { FinalCta } from './FinalCta'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'
import { LandingGuides } from './LandingGuides'
import { Reliability } from './Reliability'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { ToneShowcase } from './ToneShowcase'
import './landing.css'

export function LandingPage() {
  useEffect(() => {
    document.title = 'REM Content Studio — Listing, social, email and video copy from one property'
  }, [])

  return (
    <div className="landing" id="top">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <ChannelShowcase />
        <ToneShowcase />
        <Reliability />
        <ExportSection />
        <LandingGuides />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}
