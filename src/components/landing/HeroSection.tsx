'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 lg:pt-36 lg:pb-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left column — Text */}
          <div>
            {/* Badge */}
            <div className="animate-fade-in-up stagger-1 inline-flex items-center rounded-full border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-600">
              Agentic AI Interview Platform
            </div>

            {/* Headline */}
            <h1 className="animate-fade-in-up stagger-2 mt-6 text-4xl font-medium leading-[1.15] tracking-tight text-neutral-900 sm:text-5xl lg:text-[56px]">
              Technical Interview Platform for{' '}
              <span className="text-brand-500">Zero Engineer Bandwidth</span>
            </h1>

            {/* Subtext */}
            <p className="animate-fade-in-up stagger-3 mt-6 max-w-[500px] text-lg leading-relaxed text-neutral-500">
              HireOS conducts your entire technical hiring pipeline
              autonomously — from OA to live coding to system design. Engineers
              stay focused on building.
            </p>

            {/* CTA buttons */}
            <div className="animate-fade-in-up stagger-4 mt-8 flex flex-wrap gap-3">
              <Link href="/login">
                <Button
                  variant="primary"
                  size="lg"
                  className="transition-transform hover:scale-[1.02]"
                >
                  Start Hiring with AI
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="secondary" size="lg">
                  See a Demo
                </Button>
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-10">
              <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                Trusted by 50+ engineering teams
              </p>
              <div className="mt-3 flex items-center gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-6 w-16 rounded bg-neutral-200/60"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right column — UI mockup */}
          <div className="hidden lg:block">
            <div className="animate-float rounded-2xl bg-neutral-900 p-6 shadow-modal">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    Live Coding Round — React Engineer
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    Round 3 of 5
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-medium text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Live
                </span>
              </div>

              {/* Code area */}
              <div className="mt-4 rounded-lg bg-neutral-800 p-4 font-mono text-xs leading-relaxed">
                <div className="text-purple-400">
                  {'function '}
                  <span className="text-blue-400">optimizeArray</span>
                  <span className="text-neutral-300">{'(arr: number[]) {'}</span>
                </div>
                <div className="ml-4 text-neutral-400">
                  {'// O(n²) → Can you do O(n)?'}
                </div>
                <div className="ml-4 text-brand-300">
                  {'const seen = new Set();'}
                </div>
                <div className="ml-4 text-brand-300">
                  {'return arr.filter(n => {'}
                </div>
                <div className="ml-8 text-brand-300">
                  {'if (seen.has(n)) return false;'}
                </div>
                <div className="ml-8 text-brand-300">
                  {'seen.add(n); return true;'}
                </div>
                <div className="ml-4 text-brand-300">{'});'}</div>
                <div className="text-neutral-300">{'}'}</div>
              </div>

              {/* AI question */}
              <div className="mt-4 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3">
                <p className="text-xs font-medium text-brand-300">
                  AI Interviewer
                </p>
                <p className="mt-1 text-sm text-neutral-300">
                  Can you optimize this to O(n) complexity?
                </p>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="h-1.5 rounded-full bg-neutral-700">
                  <div
                    className="h-1.5 rounded-full bg-brand-500"
                    style={{ width: '60%' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
