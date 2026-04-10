'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageSquare, Mic, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  RoundConfigV2,
  AIQuestionPayload,
  TranscriptEntry,
  TimerUpdatePayload,
} from '@/types'
import { buildWhiteboardUpdate } from '@/lib/interviewProtocol'
import SessionTimer from '../InterviewSession/SessionTimer'
import dynamic from 'next/dynamic'

const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false },
)

interface SystemDesignRoundProps {
  sessionId: string
  sendMessage: (msg: ReturnType<typeof buildWhiteboardUpdate>) => void
  currentQuestion: AIQuestionPayload | null
  transcript: TranscriptEntry[]
  timerState: TimerUpdatePayload | null
  topicsCovered: string[]
  mustCoverRemaining: string[]
  roundConfig: RoundConfigV2
}

const DESIGN_ASPECTS = [
  'Requirements clarification',
  'Core API design',
  'Data modeling',
  'Scalability',
  'Failure modes',
]

const PHASE_GUIDE = [
  { phase: 'Requirements', minutes: 5, cumulative: 5 },
  { phase: 'Core components', minutes: 15, cumulative: 20 },
  { phase: 'Deep dive', minutes: 15, cumulative: 35 },
  { phase: 'Trade-offs & wrap-up', minutes: 10, cumulative: 45 },
]

export default function SystemDesignRound({
  sessionId,
  sendMessage,
  currentQuestion,
  transcript,
  timerState,
  topicsCovered,
  mustCoverRemaining,
  roundConfig,
}: SystemDesignRoundProps) {
  const [problemOpen, setProblemOpen] = useState(true)
  const [chatInput, setChatInput] = useState('')
  const [voiceMode, setVoiceMode] = useState(false)
  const [aiComponents, setAiComponents] = useState<string[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const excalidrawAPIRef = useRef<unknown>(null)

  const totalDuration = roundConfig.durationMinutes || 45
  const elapsed = timerState ? timerState.totalSeconds - timerState.remainingSeconds : 0
  const elapsedMinutes = Math.floor(elapsed / 60)

  const handleExcalidrawChange = useCallback(
    (elements: readonly Record<string, unknown>[]) => {
      clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        sendMessage(
          buildWhiteboardUpdate(
            sessionId,
            elements as Record<string, unknown>[],
            {},
          ),
        )
      }, 500)
    },
    [sessionId, sendMessage],
  )

  // Get initial scene for scaffold
  const getInitialData = useCallback(() => {
    if (roundConfig.scaffoldProvided) {
      return {
        elements: [
          {
            id: 'client-box',
            type: 'rectangle',
            x: 100,
            y: 200,
            width: 120,
            height: 60,
            backgroundColor: '#e3f7f1',
            strokeColor: '#0F9B77',
            label: { text: 'Client' },
          },
          {
            id: 'server-box',
            type: 'rectangle',
            x: 500,
            y: 200,
            width: 120,
            height: 60,
            backgroundColor: '#f0f0f0',
            strokeColor: '#555',
            label: { text: 'Server' },
          },
          {
            id: 'arrow-1',
            type: 'arrow',
            x: 220,
            y: 230,
            width: 280,
            height: 0,
            strokeColor: '#999',
          },
          {
            id: 'hint-text',
            type: 'text',
            x: 250,
            y: 320,
            text: 'Design your system here',
            fontSize: 16,
            strokeColor: '#999',
          },
        ],
        appState: { gridSize: 20 },
      }
    }
    return { elements: [], appState: { gridSize: 20 } }
  }, [roundConfig.scaffoldProvided])

  return (
    <div className="flex h-full">
      {/* Whiteboard (70%) */}
      <div className="flex-[7] relative">
        <Excalidraw
          onChange={handleExcalidrawChange}
          initialData={getInitialData()}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: true,
              clearCanvas: true,
              export: false,
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
          gridModeEnabled
          ref={(api: unknown) => {
            excalidrawAPIRef.current = api
          }}
        />
      </div>

      {/* Right panel (30%) */}
      <div className="flex-[3] border-l border-neutral-200 flex flex-col overflow-hidden">
        {/* Timer */}
        {timerState && (
          <div className="p-3 border-b border-neutral-100">
            <SessionTimer
              remainingSeconds={timerState.remainingSeconds}
              totalSeconds={timerState.totalSeconds}
              phase={timerState.phase}
            />
          </div>
        )}

        {/* Problem statement */}
        <div className="border-b border-neutral-200">
          <button
            onClick={() => setProblemOpen(!problemOpen)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Problem Statement
            {problemOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {problemOpen && currentQuestion && (
            <div className="px-4 pb-3 text-sm text-neutral-600 max-h-[200px] overflow-y-auto">
              {currentQuestion.questionText}
            </div>
          )}
        </div>

        {/* AI Conversation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                entry.role === 'ai'
                  ? 'bg-brand-50 text-neutral-800'
                  : 'bg-neutral-100 text-neutral-700 ml-4',
              )}
            >
              {entry.text}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div className="border-t border-neutral-200 p-3 flex items-center gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && chatInput.trim()) {
                setChatInput('')
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

        {/* Design checklist */}
        <div className="border-t border-neutral-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Design Checklist
          </h4>
          <ul className="space-y-1.5">
            {DESIGN_ASPECTS.map((aspect) => {
              const covered = topicsCovered.includes(aspect)
              return (
                <li key={aspect} className="flex items-center gap-2 text-sm">
                  <div
                    className={cn(
                      'h-4 w-4 rounded-full flex items-center justify-center',
                      covered ? 'bg-brand-500' : 'border-2 border-neutral-300',
                    )}
                  >
                    {covered && (
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12">
                        <path
                          d="M10 3L4.5 8.5L2 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                  <span className={cn('text-sm', covered ? 'text-neutral-500 line-through' : 'text-neutral-700')}>
                    {aspect}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Phase guide */}
        <div className="border-t border-neutral-200 p-4 space-y-2">
          <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            Suggested Phases
          </h4>
          <ul className="space-y-1">
            {PHASE_GUIDE.map((p) => {
              const active = elapsedMinutes >= (p.cumulative - p.minutes) && elapsedMinutes < p.cumulative
              return (
                <li
                  key={p.phase}
                  className={cn(
                    'flex items-center justify-between text-xs rounded px-2 py-1',
                    active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-neutral-500',
                  )}
                >
                  <span>{p.phase}</span>
                  <span>{p.minutes} min</span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* AI sees card */}
        {aiComponents.length > 0 && (
          <div className="border-t border-neutral-200 p-4">
            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
              AI Sees
            </h4>
            <div className="flex flex-wrap gap-1">
              {aiComponents.map((c) => (
                <span
                  key={c}
                  className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
