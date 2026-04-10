'use client'

import { cn } from '@/lib/utils'

interface ComparisonPanelProps {
  overallScore: number
  percentile: number
  cohortAvg: number
  skillScores: { name: string; candidate: number; cohort: number }[]
}

export function ComparisonPanel({
  overallScore,
  percentile,
  cohortAvg,
  skillScores,
}: ComparisonPanelProps) {
  const percentileLabel =
    percentile >= 90
      ? 'Exceptional'
      : percentile >= 70
        ? 'Strong'
        : percentile >= 40
          ? 'Average'
          : 'Below Average'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
      <h3 className="font-semibold text-gray-900">Comparison</h3>

      {/* Percentile rank */}
      <div className="text-center">
        <p className="text-3xl font-bold text-teal-600">Top {100 - percentile}%</p>
        <p className="text-sm text-gray-500 mt-1">{percentileLabel} performer</p>
        <div className="mt-3 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all"
            style={{ width: `${percentile}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0</span>
          <span>100th percentile</span>
        </div>
      </div>

      {/* Score vs cohort */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Candidate</span>
          <span className="font-semibold text-gray-900">{overallScore}/100</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Cohort Average</span>
          <span className="font-medium text-gray-500">{cohortAvg}/100</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Delta</span>
          <span
            className={cn(
              'font-medium',
              overallScore - cohortAvg >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {overallScore - cohortAvg >= 0 ? '+' : ''}
            {overallScore - cohortAvg}
          </span>
        </div>
      </div>

      {/* Radar-style skill bars (CSS-only, no Recharts dep needed) */}
      {skillScores.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Skill Breakdown</h4>
          {skillScores.map((skill) => (
            <div key={skill.name} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">{skill.name}</span>
                <span className="tabular-nums text-gray-500">
                  {skill.candidate} / {skill.cohort}
                </span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                {/* Cohort bar (gray, behind) */}
                <div
                  className="absolute inset-y-0 left-0 bg-gray-300 rounded-full"
                  style={{ width: `${skill.cohort}%` }}
                />
                {/* Candidate bar (teal, on top) */}
                <div
                  className="absolute inset-y-0 left-0 bg-teal-500 rounded-full"
                  style={{ width: `${skill.candidate}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" /> Candidate
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Cohort Avg
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
