'use client'

import { useState } from 'react'
import {
  UserPlus,
  Settings,
  Send,
  Bot,
  FileText,
  CheckCircle2,
  ArrowRight,
  ClipboardList,
  Phone,
  Code2,
  Layout,
  MessageSquare,
  Microscope,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const flowSteps = [
  { icon: UserPlus, label: 'HR Creates Role' },
  { icon: Settings, label: 'Configure Pipeline' },
  { icon: Send, label: 'Candidate Invited' },
  { icon: Bot, label: 'AI Runs Rounds' },
  { icon: FileText, label: 'Scored Report' },
  { icon: CheckCircle2, label: 'HR Decides' },
]

const roundTypes = [
  {
    number: 1,
    name: 'Online Assessment',
    description: 'MCQ + coding questions with auto-grading and integrity checks.',
    icon: ClipboardList,
    color: 'border-l-brand-500',
  },
  {
    number: 2,
    name: 'Telephonic Screen',
    description: 'AI voice agent conducts initial screening with follow-ups.',
    icon: Phone,
    color: 'border-l-purple-500',
  },
  {
    number: 3,
    name: 'Live Coding',
    description: 'Real-time IDE session with AI-driven adaptive questions.',
    icon: Code2,
    color: 'border-l-brand-500',
  },
  {
    number: 4,
    name: 'System Design',
    description: 'Whiteboard-style system design with real-time evaluation.',
    icon: Layout,
    color: 'border-l-purple-500',
  },
  {
    number: 5,
    name: 'Behavioral',
    description: 'Structured behavioral interview following STAR framework.',
    icon: MessageSquare,
    color: 'border-l-amber-500',
  },
  {
    number: 6,
    name: 'Technical Deep Dive',
    description: 'Domain-specific deep dive into past projects and expertise.',
    icon: Microscope,
    color: 'border-l-brand-500',
  },
]

export function SolutionSection() {
  const [view, setView] = useState<'flow' | 'features'>('flow')

  return (
    <section id="how-it-works" className="bg-neutral-50 py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section label */}
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-brand-500 uppercase">
          HireOS Solves It
        </p>

        {/* Headline */}
        <h2 className="mx-auto mt-4 max-w-3xl text-center text-3xl font-medium leading-tight text-neutral-900 sm:text-4xl lg:text-[48px] lg:leading-[1.15]">
          Into a Fully Autonomous Interview Pipeline
        </h2>

        {/* Toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
            <button
              onClick={() => setView('flow')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all',
                view === 'flow'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              Flow-based
            </button>
            <button
              onClick={() => setView('features')}
              className={cn(
                'rounded-full px-5 py-2 text-sm font-medium transition-all',
                view === 'features'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900'
              )}
            >
              Card-based
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-12">
          {view === 'flow' ? (
            <div>
              {/* Flow diagram */}
              <div className="flex flex-wrap items-center justify-center gap-2 md:gap-0">
                {flowSteps.map((step, i) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className="flex items-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-card">
                          <Icon className="h-6 w-6 text-brand-500" />
                        </div>
                        <p className="max-w-[100px] text-center text-xs font-medium text-neutral-700">
                          {step.label}
                        </p>
                      </div>
                      {i < flowSteps.length - 1 && (
                        <ArrowRight className="mx-2 hidden h-4 w-4 text-brand-400 md:block" />
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-8 text-center text-sm text-neutral-400">
                Zero engineer involvement until the final decision.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roundTypes.map((round) => {
                const Icon = round.icon
                return (
                  <div
                    key={round.number}
                    className={cn(
                      'rounded-xl border border-neutral-200 border-l-[3px] bg-white p-5 shadow-card transition-shadow hover:shadow-md',
                      round.color
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                        {round.number}
                      </span>
                      <Icon className="h-5 w-5 text-neutral-500" />
                    </div>
                    <h3 className="mt-3 text-base font-medium text-neutral-900">
                      {round.name}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                      {round.description}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
