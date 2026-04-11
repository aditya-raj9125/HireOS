import { createServiceRoleClient } from '@/lib/supabase/service'
import { notFound } from 'next/navigation'
import { ReportHeader } from '@/components/dashboard/report/ReportHeader'
import { RoundScoreCard } from '@/components/dashboard/report/RoundScoreCard'
import { ComparisonPanel } from '@/components/dashboard/report/ComparisonPanel'

interface Props {
  params: Promise<{ candidateId: string }>
}

export default async function CandidateReportPage({ params }: Props) {
  const { candidateId } = await params
  const supabase = createServiceRoleClient()

  // Fetch report data
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/dashboard/candidates/${candidateId}/report`,
    { cache: 'no-store' },
  )

  if (!res.ok) {
    notFound()
  }

  const report = await res.json()

  // If no rounds completed yet
  if (report.completedRoundsCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 text-teal-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Interview in Progress</h2>
        <p className="text-sm text-gray-500 mt-1">
          Results will appear here once the candidate completes a round.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <ReportHeader
        candidate={report.candidate}
        overallScore={report.overallScore}
        recommendation={report.overallRecommendation}
        completedRounds={report.completedRoundsCount}
        totalRounds={report.totalRoundsCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {report.rounds
            .filter((r: { status: string }) => r.status === 'completed')
            .map((round: Record<string, unknown>, idx: number) => (
              <RoundScoreCard key={round.id as string || idx} round={round} />
            ))}
        </div>

        <div className="space-y-6">
          <ComparisonPanel
            overallScore={report.overallScore}
            percentile={report.percentileRank}
            cohortAvg={0}
            skillScores={
              report.rounds
                .filter((r: { status: string; round_type?: string; score?: number }) => r.status === 'completed')
                .map((r: { round_type?: string; score?: number }) => ({
                  name: r.round_type || 'Round',
                  candidate: r.score || 0,
                  cohort: 0,
                }))
            }
          />
        </div>
      </div>
    </div>
  )
}
