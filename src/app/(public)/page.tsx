import { HeroSection } from '@/components/landing/HeroSection'
import { ProblemSection } from '@/components/landing/ProblemSection'
import { SolutionSection } from '@/components/landing/SolutionSection'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { CompetitiveTable } from '@/components/landing/CompetitiveTable'
import { CTASection } from '@/components/landing/CTASection'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HireOS — Agentic AI Technical Interview Platform',
  description:
    'Eliminate engineer bandwidth drain. HireOS conducts your full technical interview pipeline autonomously.',
  openGraph: {
    title: 'HireOS — Agentic AI Technical Interview Platform',
    description:
      'Eliminate engineer bandwidth drain. HireOS conducts your full technical interview pipeline autonomously.',
    type: 'website',
  },
}

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeatureGrid />
      <CompetitiveTable />
      <CTASection />
    </>
  )
}
