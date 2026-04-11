'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, ChevronDown, Mic, MessageSquare, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  RoundConfigV2,
  AIQuestionPayload,
  CodeResultPayload,
  CodeFollowUpPayload,
  TranscriptEntry,
  TimerUpdatePayload,
  TestCaseResult,
} from '@/types'
import { buildCodeUpdate, buildCodeRun } from '@/lib/interviewProtocol'
import SessionTimer from '../InterviewSession/SessionTimer'
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  { ssr: false },
)

interface LiveCodingRoundProps {
  sessionId: string
  sendMessage: (msg: ReturnType<typeof buildCodeUpdate | typeof buildCodeRun>) => void
  currentQuestion: AIQuestionPayload | null
  codeResults: CodeResultPayload | null
  codeFollowUp: CodeFollowUpPayload | null
  transcript: TranscriptEntry[]
  timerState: TimerUpdatePayload | null
  roundConfig: RoundConfigV2
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
}

export default function LiveCodingRound({
  sessionId,
  sendMessage,
  currentQuestion,
  codeResults,
  codeFollowUp,
  transcript,
  timerState,
  roundConfig,
}: LiveCodingRoundProps) {
  const allowedLangs = roundConfig.allowedLanguages?.length
    ? roundConfig.allowedLanguages
    : ['python', 'javascript', 'java', 'cpp', 'go']

  const [language, setLanguage] = useState(allowedLangs[0])
  const [code, setCode] = useState('')
  const [showLangConfirm, setShowLangConfirm] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [followUpInput, setFollowUpInput] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)
  const [testCases, setTestCases] = useState<
    { input: string; expected: string; actual: string; status: string }[]
  >([])
  const [customTests, setCustomTests] = useState<{ input: string; expected: string }[]>([])

  const editorRef = useRef<unknown>(null)
  const snapshotIndexRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const snapshotTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  // Initialize test cases from problem
  useEffect(() => {
    if (currentQuestion?.problemStatement) {
      const problem = currentQuestion.problemStatement
      const cases = (problem.test_cases as { input: string; expected: string; isHidden?: boolean }[])
        .filter((tc) => !tc.isHidden)
        .map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          actual: '',
          status: 'pending',
        }))
      setTestCases(cases)
    }
  }, [currentQuestion])

  // Periodic snapshots every 30s
  useEffect(() => {
    snapshotTimerRef.current = setInterval(() => {
      if (code.length > 0) {
        sendMessage(
          buildCodeUpdate(sessionId, code, language, 0, 0, snapshotIndexRef.current++),
        )
      }
    }, 30000)
    return () => clearInterval(snapshotTimerRef.current)
  }, [code, language, sessionId, sendMessage])

  // Show "AI analyzing" on code update
  useEffect(() => {
    if (code.length > 0) {
      setIsAnalyzing(true)
      const t = setTimeout(() => setIsAnalyzing(false), 3000)
      return () => clearTimeout(t)
    }
  }, [code])

  // Update test results when codeResults arrives
  useEffect(() => {
    if (codeResults) {
      setIsRunning(false)
      setTestCases((prev) =>
        prev.map((tc, i) => {
          const result = codeResults.testResults[i]
          if (!result) return tc
          return {
            ...tc,
            actual: result.actual,
            status: result.passed ? 'pass' : result.error ? 'error' : 'fail',
          }
        }),
      )
    }
  }, [codeResults])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const code = value ?? ''
      setCode(code)

      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        sendMessage(
          buildCodeUpdate(sessionId, code, language, 0, 0, snapshotIndexRef.current++),
        )
      }, 300)
    },
    [sessionId, language, sendMessage],
  )

  const handleEditorMount = useCallback(
    (editor: unknown) => {
      editorRef.current = editor
      // Detect paste events
      // @ts-expect-error Monaco editor type
      editor.onDidPaste?.(() => {
        // Logged by ProctorOverlay via paste event
      })
    },
    [],
  )

  const handleLanguageChange = (lang: string) => {
    if (code.length > 0) {
      setShowLangConfirm(lang)
    } else {
      setLanguage(lang)
    }
  }

  const confirmLanguageChange = () => {
    if (showLangConfirm) {
      setLanguage(showLangConfirm)
      setCode('')
      setShowLangConfirm(null)
    }
  }

  const runCode = () => {
    setIsRunning(true)
    const allTests = [
      ...testCases.map((tc) => ({ input: tc.input, expected: tc.expected })),
      ...customTests,
    ]
    sendMessage(buildCodeRun(sessionId, code, language, allTests) as ReturnType<typeof buildCodeUpdate>)
    setTestCases((prev) => prev.map((tc) => ({ ...tc, status: 'running', actual: '' })))
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-neutral-200 bg-white px-4 py-2">
        <h2 className="text-sm font-semibold text-neutral-800 flex-1 truncate">
          {currentQuestion?.questionText
            ? currentQuestion.questionText.slice(0, 60)
            : 'Loading problem...'}
        </h2>

        {/* Language selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="appearance-none rounded border border-neutral-300 bg-white px-3 py-1.5 pr-8 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
          >
            {allowedLangs.map((lang) => (
              <option key={lang} value={lang}>
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        </div>

        <button
          onClick={runCode}
          disabled={isRunning || code.length === 0}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:bg-neutral-300"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run Code
        </button>

        {timerState && (
          <SessionTimer
            remainingSeconds={timerState.remainingSeconds}
            totalSeconds={timerState.totalSeconds}
            phase={timerState.phase}
          />
        )}
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Monaco Editor */}
        <div className="flex-1 min-w-0">
          <MonacoEditor
            height="100%"
            language={LANGUAGE_EXTENSIONS[language] || 'plaintext'}
            value={code}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              wordWrap: 'on',
              fontSize: 14,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
              quickSuggestions: false,
              suggestOnTriggerCharacters: false,
              parameterHints: { enabled: false },
              wordBasedSuggestions: 'off',
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              padding: { top: 16 },
            }}
          />
        </div>

        {/* Right panel */}
        <div className="flex w-[400px] flex-col border-l border-neutral-200">
          {/* Top-right: AI question + follow-ups */}
          <div className="flex-1 overflow-y-auto border-b border-neutral-200 p-4 space-y-3">
            {/* Problem statement */}
            {currentQuestion && (
              <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700 prose prose-sm max-w-none">
                <div
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.questionText.replace(/\n/g, '<br />'),
                  }}
                />
              </div>
            )}

            {/* AI analyzing skeleton */}
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI is analyzing your code...
              </div>
            )}

            {/* Code follow-up */}
            {codeFollowUp && (
              <div className="rounded-lg bg-brand-50 p-3 text-sm text-neutral-800 animate-[slide-in_300ms_ease-out]">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center">
                    <MessageSquare className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-brand-700">AI Follow-up</span>
                </div>
                {codeFollowUp.questionText}
              </div>
            )}

            {/* Follow-up input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && followUpInput.trim()) {
                    // Send as transcript text
                    setFollowUpInput('')
                  }
                }}
                placeholder="Type your response..."
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={() => setVoiceMode(!voiceMode)}
                className={cn(
                  'rounded-lg p-2',
                  voiceMode ? 'bg-brand-100 text-brand-600' : 'bg-neutral-100 text-neutral-500',
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Bottom-right: Test cases */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
                Test Cases
              </h4>
              <button
                onClick={() =>
                  setCustomTests((prev) => [...prev, { input: '', expected: '' }])
                }
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                <Plus className="h-3 w-3" />
                Add custom
              </button>
            </div>

            {testCases.map((tc, i) => (
              <div
                key={i}
                className="rounded-lg border border-neutral-200 p-3 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-600">Case {i + 1}</span>
                  <StatusBadge status={tc.status} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-neutral-400 mb-0.5">Input</p>
                    <pre className="rounded bg-neutral-50 p-1.5 whitespace-pre-wrap font-mono text-neutral-700">
                      {tc.input}
                    </pre>
                  </div>
                  <div>
                    <p className="text-neutral-400 mb-0.5">Expected</p>
                    <pre className="rounded bg-neutral-50 p-1.5 whitespace-pre-wrap font-mono text-neutral-700">
                      {tc.expected}
                    </pre>
                  </div>
                  <div>
                    <p className="text-neutral-400 mb-0.5">Actual</p>
                    <pre
                      className={cn(
                        'rounded p-1.5 whitespace-pre-wrap font-mono',
                        tc.status === 'pass'
                          ? 'bg-green-50 text-green-700'
                          : tc.status === 'fail'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-neutral-50 text-neutral-400',
                      )}
                    >
                      {tc.actual || '—'}
                    </pre>
                  </div>
                </div>
              </div>
            ))}

            {/* Custom test cases (editable) */}
            {customTests.map((ct, i) => (
              <div
                key={`custom-${i}`}
                className="rounded-lg border border-dashed border-neutral-300 p-3 space-y-1.5 text-xs"
              >
                <span className="font-medium text-neutral-500">Custom {i + 1}</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ct.input}
                    onChange={(e) =>
                      setCustomTests((prev) =>
                        prev.map((c, j) => (j === i ? { ...c, input: e.target.value } : c)),
                      )
                    }
                    placeholder="Input"
                    className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
                  />
                  <input
                    type="text"
                    value={ct.expected}
                    onChange={(e) =>
                      setCustomTests((prev) =>
                        prev.map((c, j) => (j === i ? { ...c, expected: e.target.value } : c)),
                      )
                    }
                    placeholder="Expected"
                    className="rounded border border-neutral-300 px-2 py-1 font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Language change confirmation dialog */}
      {showLangConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-xl max-w-sm">
            <h3 className="text-sm font-semibold text-neutral-800 mb-2">Change Language?</h3>
            <p className="text-sm text-neutral-600 mb-4">
              Changing language will clear your current code. Continue?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLangConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmLanguageChange}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-neutral-100 text-neutral-500',
    running: 'bg-amber-100 text-amber-600',
    pass: 'bg-green-100 text-green-700',
    fail: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending: 'Pending',
    running: 'Running...',
    pass: 'Pass',
    fail: 'Fail',
    error: 'Error',
  }
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', styles[status])}>
      {labels[status] ?? status}
    </span>
  )
}
