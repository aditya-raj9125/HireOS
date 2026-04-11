'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TranscriptEntry, AIQuestionPayload, RoundConfigV2 } from '@/types'
import { buildAudioChunk, buildCandidateInterrupt } from '@/lib/interviewProtocol'
import SessionTimer from '../InterviewSession/SessionTimer'
import type { TimerUpdatePayload } from '@/types'

interface VoiceRoundProps {
  sessionId: string
  sendMessage: (msg: ReturnType<typeof buildAudioChunk>) => void
  transcript: TranscriptEntry[]
  isAISpeaking: boolean
  currentQuestion: AIQuestionPayload | null
  timerState: TimerUpdatePayload | null
  topicsCovered: string[]
  mustCoverRemaining: string[]
  roundConfig: RoundConfigV2
  roundName: string
  roundType: 'telephonic_screen' | 'behavioral'
}

const TIPS: Record<string, string[]> = {
  telephonic_screen: [
    'Keep answers concise — aim for 1-2 minutes per response',
    'Use specific examples from your experience',
    'It\'s okay to ask the interviewer to clarify a question',
  ],
  behavioral: [
    'Use the STAR method: Situation, Task, Action, Result',
    'Focus on your personal contributions',
    'Quantify impacts where possible (%, $, time saved)',
  ],
}

export default function VoiceRound({
  sessionId,
  sendMessage,
  transcript,
  isAISpeaking,
  currentQuestion,
  timerState,
  topicsCovered,
  mustCoverRemaining,
  roundConfig,
  roundName,
  roundType,
}: VoiceRoundProps) {
  const [muted, setMuted] = useState(false)
  const [partialText, setPartialText] = useState('')
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(true)

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const seqRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Audio playback queue
  const playQueueRef = useRef<AudioBuffer[]>([])
  const playingRef = useRef(false)
  const playCtxRef = useRef<AudioContext | null>(null)

  // Auto-scroll transcript
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript.length])

  // Show thinking dots when candidate finishes speaking and waiting for AI
  useEffect(() => {
    if (!isCandidateSpeaking && transcript.length > 0) {
      const last = transcript[transcript.length - 1]
      if (last.role === 'candidate' && !isAISpeaking) {
        setShowThinking(true)
      }
    }
    if (isAISpeaking) {
      setShowThinking(false)
    }
  }, [isCandidateSpeaking, isAISpeaking, transcript])

  // Start mic capture
  useEffect(() => {
    let cancelled = false

    async function startCapture() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)

        // ScriptProcessor for capturing PCM chunks
        const processor = audioCtx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (e) => {
          if (muted || cancelled) return

          const input = e.inputBuffer.getChannelData(0)

          // VAD: calculate RMS
          let sum = 0
          for (let i = 0; i < input.length; i++) {
            sum += input[i] * input[i]
          }
          const rms = Math.sqrt(sum / input.length)

          if (rms > 0.015) {
            setIsCandidateSpeaking(true)
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = setTimeout(() => {
              setIsCandidateSpeaking(false)
            }, 1200)

            // If AI is speaking, interrupt
            if (isAISpeaking) {
              sendMessage(buildCandidateInterrupt(sessionId) as ReturnType<typeof buildAudioChunk>)
              stopPlayback()
            }
          }

          // Convert float32 to base64 PCM16
          const pcm16 = new Int16Array(input.length)
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]))
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }
          const bytes = new Uint8Array(pcm16.buffer)
          const b64 = btoa(String.fromCharCode(...bytes))

          sendMessage(buildAudioChunk(sessionId, b64, 16000, seqRef.current++))
        }

        source.connect(processor)
        processor.connect(audioCtx.destination) // Required for processing to work
      } catch {
        // Mic permission denied — user remains muted
      }
    }

    startCapture()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mute/unmute
  useEffect(() => {
    const tracks = streamRef.current?.getAudioTracks()
    tracks?.forEach((t) => {
      t.enabled = !muted
    })
  }, [muted])

  // Audio playback
  const stopPlayback = useCallback(() => {
    playQueueRef.current = []
    playingRef.current = false
  }, [])

  // Question progress dots
  const questionCount = (roundConfig as unknown as Record<string, unknown>).preferredQuestionCount as number || 6
  const currentIdx = currentQuestion?.questionIndex ?? 0

  return (
    <div className="flex h-full flex-col lg:flex-row gap-4 p-4">
      {/* Left panel — conversation */}
      <div className="flex flex-1 flex-col lg:w-3/5">
        {/* AI Avatar */}
        <div className="flex items-center justify-center py-6">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-brand-100">
            {/* Waveform bars */}
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'w-1 rounded-full bg-brand-500 transition-all duration-200',
                    isAISpeaking
                      ? 'animate-[wave_0.6s_ease-in-out_infinite]'
                      : 'h-2',
                  )}
                  style={{
                    animationDelay: isAISpeaking ? `${i * 0.1}s` : undefined,
                    height: isAISpeaking ? undefined : 8,
                  }}
                />
              ))}
            </div>
            {isAISpeaking && (
              <div className="absolute inset-0 rounded-full border-2 border-brand-300 animate-ping opacity-30" />
            )}
          </div>
        </div>

        {/* Transcript thread */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-3 px-2 pb-4 max-h-[50vh]"
        >
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm animate-[fade-up_200ms_ease-out]',
                entry.role === 'ai'
                  ? 'self-start bg-brand-50 text-neutral-800 mr-auto'
                  : 'self-end bg-neutral-100 text-neutral-800 ml-auto',
              )}
            >
              {entry.text}
            </div>
          ))}

          {/* Thinking dots */}
          {showThinking && (
            <div className="max-w-[80%] rounded-2xl bg-brand-50 px-4 py-3 mr-auto">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full bg-brand-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Partial transcript strip */}
        {partialText && (
          <div className="px-4 py-2 text-sm italic text-neutral-400 border-t border-neutral-100">
            You: {partialText}
          </div>
        )}

        {/* Mic control */}
        <div className="flex flex-col items-center gap-2 py-4 border-t border-neutral-100">
          <button
            onClick={() => setMuted(!muted)}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full transition-colors',
              muted ? 'bg-red-100 text-red-600' : 'bg-brand-100 text-brand-600',
              isCandidateSpeaking && !muted && 'ring-4 ring-brand-200 animate-pulse',
            )}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          <span className="text-xs text-neutral-500">
            {muted ? 'Unmute to speak' : 'Voice respond'}
          </span>
        </div>
      </div>

      {/* Right panel — metadata */}
      <div className="lg:w-2/5 space-y-4 border-l border-neutral-100 pl-4">
        {/* Timer */}
        {timerState && (
          <SessionTimer
            remainingSeconds={timerState.remainingSeconds}
            totalSeconds={timerState.totalSeconds}
            phase={timerState.phase}
          />
        )}

        {/* Round name */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-800">{roundName}</h3>
          <span className="inline-block mt-1 rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {roundType === 'telephonic_screen' ? 'Telephonic Screen' : 'Behavioral'}
          </span>
        </div>

        {/* Question progress */}
        <div>
          <p className="text-xs font-medium text-neutral-500 mb-2">
            Question {currentIdx + 1} of {questionCount}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: questionCount }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i < currentIdx
                    ? 'bg-brand-500'
                    : i === currentIdx
                      ? 'bg-brand-500 animate-pulse'
                      : 'bg-neutral-200',
                )}
              />
            ))}
          </div>
        </div>

        {/* Current topic */}
        {currentQuestion?.topic && (
          <div className="rounded-lg bg-neutral-50 p-3">
            <p className="text-xs font-medium text-neutral-500">Current Topic</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {currentQuestion.topic}
            </p>
          </div>
        )}

        {/* Must-cover topics checklist */}
        {(mustCoverRemaining.length > 0 || topicsCovered.length > 0) && (
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Must-Cover Topics</p>
            <ul className="space-y-1.5">
              {topicsCovered.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-4 rounded-full bg-brand-500 flex items-center justify-center">
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
                  </div>
                  <span className="text-neutral-600 line-through">{t}</span>
                </li>
              ))}
              {mustCoverRemaining.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-4 rounded-full border-2 border-neutral-300" />
                  <span className="text-neutral-800">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tips */}
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          <button
            onClick={() => setTipsOpen(!tipsOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Tips for this round
            <span className={cn('transition-transform', tipsOpen && 'rotate-180')}>▾</span>
          </button>
          {tipsOpen && (
            <ul className="px-3 pb-3 space-y-1.5">
              {(TIPS[roundType] || TIPS.telephonic_screen).map((tip, i) => (
                <li key={i} className="text-xs text-neutral-500 flex gap-2">
                  <span className="text-brand-500 mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 24px; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
