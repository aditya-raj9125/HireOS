'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RoundScoreCardProps {
  round: Record<string, unknown>
}

const ROUND_TYPE_ICONS: Record<string, string> = {
  telephonic_screen: '📞',
  live_coding: '💻',
  system_design: '🏗️',
  behavioral: '🤝',
  deep_dive: '🔬',
  online_assessment: '📝',
}

export function RoundScoreCard({ round }: RoundScoreCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [showProctor, setShowProctor] = useState(false)

  const roundType = round.round_type as string
  const score = (round.score as number) || 0
  const transcript = (round.transcript as { role: string; text: string; timestamp: number }[]) || []
  const proctorLog = (round.proctor_log as unknown[]) || []
  const recordings = (round.recordings as { type: string; url: string }[]) || []
  const codeReplay = (round.code_replay as unknown[]) || []

  // Score circle
  const circumference = 2 * Math.PI * 36
  const progress = (score / 100) * circumference
  const scoreColor = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'
  const strokeColor = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'

  const recommendation =
    score >= 70 ? 'advance' : score >= 40 ? 'hold' : 'reject'

  const recStyles = {
    advance: 'bg-emerald-50 text-emerald-700',
    hold: 'bg-amber-50 text-amber-700',
    reject: 'bg-red-50 text-red-700',
  }

  const completedDate = round.started_at
    ? new Date(round.started_at as string).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Left teal border */}
      <div className="border-l-4 border-teal-500">
        {/* Header */}
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{ROUND_TYPE_ICONS[roundType] || '📋'}</span>
            <div>
              <h3 className="font-semibold text-gray-900 capitalize">
                {roundType?.replace(/_/g, ' ')}
              </h3>
              <p className="text-xs text-gray-500">{completedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Score circle */}
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="4"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-lg font-bold', scoreColor)}>{score}</span>
              </div>
            </div>

            <span className={cn('px-2 py-1 rounded text-xs font-medium', recStyles[recommendation])}>
              {recommendation.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Expandable content */}
        <div className="px-5 pb-5 space-y-4">
          {/* Skill scores table (if available from anti_ai_signals or embedded) */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-teal-600 hover:text-teal-700 font-medium"
          >
            {expanded ? '▾ Hide details' : '▸ Show details'}
          </button>

          {expanded && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Transcript */}
              {transcript.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
                    {transcript.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          'text-sm rounded-lg px-3 py-2 max-w-[85%]',
                          entry.role === 'ai'
                            ? 'bg-teal-50 text-teal-900 mr-auto'
                            : 'bg-white text-gray-900 ml-auto border border-gray-200',
                        )}
                      >
                        <span className="text-xs font-medium text-gray-500 block mb-0.5">
                          {entry.role === 'ai' ? 'Interviewer' : 'Candidate'}
                        </span>
                        {entry.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording player */}
              {recordings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Recording</h4>
                  {recordings
                    .filter((r) => r.type === 'video' || r.type === 'audio')
                    .map((rec, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3">
                        {rec.type === 'video' ? (
                          <video
                            controls
                            className="w-full rounded-lg"
                            src={rec.url}
                            preload="metadata"
                          />
                        ) : (
                          <audio controls className="w-full" src={rec.url} preload="metadata" />
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Proctor summary */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Integrity:</span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    proctorLog.length === 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : proctorLog.length <= 3
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700',
                  )}
                >
                  {proctorLog.length === 0
                    ? 'No concerns'
                    : `${proctorLog.length} flag${proctorLog.length > 1 ? 's' : ''}`}
                </span>

                {proctorLog.length > 0 && (
                  <button
                    onClick={() => setShowProctor(!showProctor)}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    {showProctor ? 'Hide' : 'View flags'}
                  </button>
                )}
              </div>

              {showProctor && proctorLog.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  {(proctorLog as { type: string; timestamp: number; severity: string }[]).map(
                    (event, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            'w-2 h-2 rounded-full',
                            event.severity === 'high'
                              ? 'bg-red-400'
                              : event.severity === 'medium'
                                ? 'bg-amber-400'
                                : 'bg-gray-400',
                          )}
                        />
                        <span className="text-gray-600">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-gray-700 capitalize">
                          {event.type?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* AI Confidence */}
              {round.anti_ai_signals && (
                <AIConfidenceNote antiAiSignals={round.anti_ai_signals as { likelihood?: number; indicators?: string[] }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AIConfidenceNote({
  antiAiSignals,
}: {
  antiAiSignals: { likelihood?: number; indicators?: string[] }
}) {
  const likelihood = antiAiSignals.likelihood ?? 0

  if (likelihood < 0.3) return null

  return (
    <div
      className={cn(
        'rounded-lg p-3 text-sm',
        likelihood >= 0.5 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50',
      )}
    >
      {likelihood >= 0.5 ? (
        <>
          <p className="font-medium text-amber-700 mb-1">
            ⚠ AI-Assisted Answer Signals Detected
          </p>
          <p className="text-amber-600 text-xs">
            Some responses showed patterns consistent with AI-assisted answers. Review the recording
            for verification. This is a signal, not a conclusion.
          </p>
          {antiAiSignals.indicators && antiAiSignals.indicators.length > 0 && (
            <ul className="mt-1 text-xs text-amber-600 list-disc list-inside">
              {antiAiSignals.indicators.map((ind, i) => (
                <li key={i}>{ind}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-xs">
          Low AI-assistance likelihood ({Math.round(likelihood * 100)}%).
        </p>
      )}
    </div>
  )
}
