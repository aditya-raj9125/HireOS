'use client'

import { cn } from '@/lib/utils'

interface ReportHeaderProps {
  candidate: {
    id: string
    fullName: string
    email: string
    status: string
  }
  overallScore: number
  recommendation: 'advance' | 'hold' | 'reject'
  completedRounds: number
  totalRounds: number
}

const RECOMMENDATION_STYLES = {
  advance: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'ADVANCE' },
  hold: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'HOLD' },
  reject: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'REJECT' },
}

export function ReportHeader({
  candidate,
  overallScore,
  recommendation,
  completedRounds,
  totalRounds,
}: ReportHeaderProps) {
  const recStyle = RECOMMENDATION_STYLES[recommendation]

  const initials = candidate.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const handleAction = async (action: string) => {
    await fetch(`/api/candidates/${candidate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: action }),
    })
    window.location.reload()
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Left: Candidate info */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{candidate.fullName}</h1>
            <p className="text-sm text-gray-500">{candidate.email}</p>
          </div>
        </div>

        {/* Center: Score and recommendation */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {overallScore}
              <span className="text-lg font-normal text-gray-400">/100</span>
            </div>
            <p className="text-xs text-gray-500">Overall Score</p>
          </div>

          <div
            className={cn(
              'px-4 py-2 rounded-lg border font-semibold text-sm',
              recStyle.bg,
              recStyle.text,
              recStyle.border,
            )}
          >
            {recStyle.label}
          </div>

          <div className="text-center">
            <div className="text-sm font-medium text-gray-700">
              {completedRounds} of {totalRounds}
            </div>
            <p className="text-xs text-gray-500">Rounds</p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('advanced')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
          >
            Advance
          </button>
          <button
            onClick={() => handleAction('on_hold')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
          >
            Hold
          </button>
          <button
            onClick={() => handleAction('rejected')}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
