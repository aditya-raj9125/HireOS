'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Flag,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Loader2,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OAProblem, RoundConfigV2, TimerUpdatePayload } from '@/types'
import SessionTimer from '../InterviewSession/SessionTimer'
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  { ssr: false },
)

interface OARoundProps {
  token: string
  timerState: TimerUpdatePayload | null
  roundConfig: RoundConfigV2
}

type MCQAnswer = { problemId: string; selectedOptionId: string | null; flagged: boolean; timeSpent: number }
type CodingSolution = {
  problemId: string
  code: string
  language: string
  submitted: boolean
  testResults: { input: string; expected: string; actual: string; passed: boolean }[]
}

export default function OARound({ token, timerState, roundConfig }: OARoundProps) {
  const [activeTab, setActiveTab] = useState<'mcq' | 'coding'>('mcq')
  const [problems, setProblems] = useState<OAProblem[]>([])
  const [loading, setLoading] = useState(true)

  // MCQ state
  const [mcqAnswers, setMcqAnswers] = useState<MCQAnswer[]>([])
  const [mcqIndex, setMcqIndex] = useState(0)
  const [mcqSubmitted, setMcqSubmitted] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // Coding state
  const [codingSolutions, setCodingSolutions] = useState<CodingSolution[]>([])
  const [codingIndex, setCodingIndex] = useState(0)
  const [codingRunning, setCodingRunning] = useState(false)

  // Timing
  const lastNavTimeRef = useRef(Date.now())

  const mcqProblems = problems.filter((p) => p.type === 'mcq')
  const codingProblems = problems.filter((p) => p.type === 'coding')

  // Fetch problems
  useEffect(() => {
    async function fetchProblems() {
      try {
        const res = await fetch(`/api/portal/${token}/oa-problems`)
        if (res.ok) {
          const data = await res.json()
          setProblems(data.problems ?? [])

          const mcqs = (data.problems ?? []).filter((p: OAProblem) => p.type === 'mcq')
          setMcqAnswers(
            mcqs.map((p: OAProblem) => ({
              problemId: p.id,
              selectedOptionId: null,
              flagged: false,
              timeSpent: 0,
            })),
          )

          const coding = (data.problems ?? []).filter((p: OAProblem) => p.type === 'coding')
          setCodingSolutions(
            coding.map((p: OAProblem) => ({
              problemId: p.id,
              code: '',
              language: 'python',
              submitted: false,
              testResults: [],
            })),
          )
        }
      } finally {
        setLoading(false)
      }
    }
    fetchProblems()
  }, [token])

  // Track time on MCQ navigation
  const trackTime = useCallback(() => {
    const now = Date.now()
    const elapsed = (now - lastNavTimeRef.current) / 1000
    setMcqAnswers((prev) =>
      prev.map((a, i) =>
        i === mcqIndex ? { ...a, timeSpent: a.timeSpent + elapsed } : a,
      ),
    )
    lastNavTimeRef.current = now
  }, [mcqIndex])

  const navigateMCQ = (idx: number) => {
    trackTime()
    setMcqIndex(idx)
  }

  const selectOption = (optionId: string) => {
    setMcqAnswers((prev) =>
      prev.map((a, i) =>
        i === mcqIndex ? { ...a, selectedOptionId: optionId } : a,
      ),
    )
  }

  const toggleFlag = () => {
    setMcqAnswers((prev) =>
      prev.map((a, i) => (i === mcqIndex ? { ...a, flagged: !a.flagged } : a)),
    )
  }

  const submitMCQ = async () => {
    trackTime()
    setMcqSubmitted(true)
    setShowSubmitConfirm(false)
    await fetch(`/api/portal/${token}/submit-oa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: 'mcq', answers: mcqAnswers }),
    })
  }

  const runCodingSolution = async () => {
    const sol = codingSolutions[codingIndex]
    if (!sol) return
    setCodingRunning(true)
    try {
      const res = await fetch(`/api/portal/${token}/submit-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId: sol.problemId,
          code: sol.code,
          language: sol.language,
          run: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setCodingSolutions((prev) =>
          prev.map((s, i) =>
            i === codingIndex ? { ...s, testResults: data.testResults ?? [] } : s,
          ),
        )
      }
    } finally {
      setCodingRunning(false)
    }
  }

  const submitCodingSolution = async () => {
    const sol = codingSolutions[codingIndex]
    if (!sol) return
    await fetch(`/api/portal/${token}/submit-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemId: sol.problemId,
        code: sol.code,
        language: sol.language,
        submit: true,
      }),
    })
    setCodingSolutions((prev) =>
      prev.map((s, i) => (i === codingIndex ? { ...s, submitted: true } : s)),
    )
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    )
  }

  // Completed state
  const allDone = mcqSubmitted && codingSolutions.every((s) => s.submitted)
  if (allDone) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-800">Assessment Complete</h2>
        <p className="text-sm text-neutral-500 max-w-sm text-center">
          Your responses have been submitted. You can close this window now.
        </p>
      </div>
    )
  }

  const unansweredCount = mcqAnswers.filter((a) => !a.selectedOptionId).length
  const flaggedCount = mcqAnswers.filter((a) => a.flagged).length

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b border-neutral-200 bg-white px-4">
        <button
          onClick={() => setActiveTab('mcq')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'mcq'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
        >
          MCQ Section
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
            {mcqAnswers.filter((a) => a.selectedOptionId).length}/{mcqProblems.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('coding')}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'coding'
              ? 'border-brand-500 text-brand-700'
              : 'border-transparent text-neutral-500 hover:text-neutral-700',
          )}
        >
          Coding Problems
          <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs">
            {codingSolutions.filter((s) => s.submitted).length}/{codingProblems.length}
          </span>
        </button>

        <div className="ml-auto">
          {timerState && (
            <SessionTimer
              remainingSeconds={timerState.remainingSeconds}
              totalSeconds={timerState.totalSeconds}
              phase={timerState.phase}
            />
          )}
        </div>
      </div>

      {/* MCQ Section */}
      {activeTab === 'mcq' && !mcqSubmitted && (
        <div className="flex flex-1 overflow-hidden">
          {/* Question area */}
          <div className="flex-1 overflow-y-auto p-6">
            {mcqProblems[mcqIndex] && (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-500">
                    Question {mcqIndex + 1} of {mcqProblems.length}
                  </h3>
                  <button
                    onClick={toggleFlag}
                    className={cn(
                      'flex items-center gap-1 text-sm',
                      mcqAnswers[mcqIndex]?.flagged
                        ? 'text-amber-600'
                        : 'text-neutral-400 hover:text-neutral-600',
                    )}
                  >
                    <Flag className="h-4 w-4" />
                    {mcqAnswers[mcqIndex]?.flagged ? 'Flagged' : 'Flag for review'}
                  </button>
                </div>

                <div className="text-sm text-neutral-800 leading-relaxed">
                  {mcqProblems[mcqIndex].description}
                </div>

                {/* Options */}
                <div className="space-y-2">
                  {(
                    mcqProblems[mcqIndex].options as { id: string; text: string }[]
                  )?.map((opt, oi) => {
                    const selected = mcqAnswers[mcqIndex]?.selectedOptionId === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectOption(opt.id)}
                        className={cn(
                          'w-full rounded-lg border-2 p-4 text-left text-sm transition-colors',
                          selected
                            ? 'border-brand-500 bg-brand-50 text-neutral-800'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
                        )}
                      >
                        <span className="font-medium mr-2 text-neutral-500">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt.text}
                      </button>
                    )
                  })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-4">
                  <button
                    onClick={() => navigateMCQ(mcqIndex - 1)}
                    disabled={mcqIndex === 0}
                    className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-800 disabled:text-neutral-300"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  {mcqIndex < mcqProblems.length - 1 ? (
                    <button
                      onClick={() => navigateMCQ(mcqIndex + 1)}
                      className="flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSubmitConfirm(true)}
                      className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
                    >
                      Submit MCQ Section
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Question navigator grid */}
          <div className="w-48 border-l border-neutral-200 p-4 overflow-y-auto">
            <h4 className="text-xs font-semibold text-neutral-500 uppercase mb-3">Questions</h4>
            <div className="grid grid-cols-5 gap-1.5">
              {mcqAnswers.map((a, i) => (
                <button
                  key={i}
                  onClick={() => navigateMCQ(i)}
                  className={cn(
                    'h-8 w-8 rounded text-xs font-medium transition-colors',
                    i === mcqIndex && 'ring-2 ring-brand-500',
                    a.flagged
                      ? 'bg-amber-100 text-amber-700'
                      : a.selectedOptionId
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-neutral-100 text-neutral-500',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MCQ submitted state */}
      {activeTab === 'mcq' && mcqSubmitted && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <Check className="h-10 w-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-700">MCQ Section Submitted</p>
          </div>
        </div>
      )}

      {/* Coding Section */}
      {activeTab === 'coding' && (
        <div className="flex flex-1 overflow-hidden flex-col">
          {/* Problem tabs */}
          <div className="flex border-b border-neutral-200 bg-neutral-50 px-4">
            {codingProblems.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setCodingIndex(i)}
                className={cn(
                  'px-3 py-2 text-xs font-medium border-b-2 transition-colors mx-1',
                  i === codingIndex
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-neutral-500',
                  codingSolutions[i]?.submitted && 'text-green-600',
                )}
              >
                Problem {i + 1}
                {codingSolutions[i]?.submitted && <Lock className="inline ml-1 h-3 w-3" />}
              </button>
            ))}
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Problem description */}
            <div className="w-[350px] overflow-y-auto border-r border-neutral-200 p-4">
              {codingProblems[codingIndex] && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-neutral-800">
                    {codingProblems[codingIndex].title}
                  </h3>
                  <span
                    className={cn(
                      'inline-block rounded px-2 py-0.5 text-xs font-medium',
                      codingProblems[codingIndex].difficulty === 'easy'
                        ? 'bg-green-100 text-green-700'
                        : codingProblems[codingIndex].difficulty === 'medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700',
                    )}
                  >
                    {codingProblems[codingIndex].difficulty}
                  </span>
                  <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                    {codingProblems[codingIndex].description}
                  </div>
                </div>
              )}
            </div>

            {/* Code editor + tests */}
            <div className="flex-1 flex flex-col">
              {/* Editor */}
              <div className="flex-1 relative">
                {codingSolutions[codingIndex]?.submitted ? (
                  <div className="absolute inset-0 bg-neutral-900/80 z-10 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Lock className="h-8 w-8 mx-auto mb-2 opacity-60" />
                      <p className="text-sm">Solution Submitted</p>
                    </div>
                  </div>
                ) : null}
                <MonacoEditor
                  height="100%"
                  language={codingSolutions[codingIndex]?.language ?? 'python'}
                  value={codingSolutions[codingIndex]?.code ?? ''}
                  onChange={(val: string | undefined) => {
                    setCodingSolutions((prev) =>
                      prev.map((s, i) =>
                        i === codingIndex ? { ...s, code: val ?? '' } : s,
                      ),
                    )
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    quickSuggestions: false,
                    suggestOnTriggerCharacters: false,
                    parameterHints: { enabled: false },
                    wordBasedSuggestions: 'off',
                    readOnly: codingSolutions[codingIndex]?.submitted,
                  }}
                />
              </div>

              {/* Test results + actions */}
              <div className="border-t border-neutral-200 p-3 max-h-[200px] overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={runCodingSolution}
                    disabled={codingRunning || codingSolutions[codingIndex]?.submitted}
                    className="flex items-center gap-1 rounded bg-neutral-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
                  >
                    {codingRunning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    Run
                  </button>
                  <button
                    onClick={submitCodingSolution}
                    disabled={codingSolutions[codingIndex]?.submitted}
                    className="rounded bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    Submit Solution
                  </button>
                </div>

                {codingSolutions[codingIndex]?.testResults.map((tr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs py-1 border-b border-neutral-100 last:border-0"
                  >
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 font-medium',
                        tr.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                      )}
                    >
                      {tr.passed ? 'Pass' : 'Fail'}
                    </span>
                    <span className="text-neutral-500 font-mono">In: {tr.input}</span>
                    <span className="text-neutral-500 font-mono">Exp: {tr.expected}</span>
                    <span className="text-neutral-500 font-mono">Got: {tr.actual}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm">
            <h3 className="text-sm font-semibold text-neutral-800 mb-3">Submit MCQ Section?</h3>
            {(unansweredCount > 0 || flaggedCount > 0) && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-3 space-y-1">
                {unansweredCount > 0 && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {unansweredCount} question(s) unanswered
                  </p>
                )}
                {flaggedCount > 0 && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    {flaggedCount} question(s) flagged for review
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Go Back
              </button>
              <button
                onClick={submitMCQ}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
