import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { FunnelChart } from '@/components/dashboard/FunnelChart'
import { ScoreDistribution } from '@/components/dashboard/ScoreDistribution'
import { SourcePieChart } from '@/components/dashboard/SourcePieChart'
import { TimeToHireCard } from '@/components/dashboard/TimeToHireCard'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { Briefcase, Users, CheckCircle2, Clock } from 'lucide-react'
import type { FunnelStage, ScoreDistributionBucket, SourceBreakdown } from '@/types'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.organization_id

  if (!orgId) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-semibold text-neutral-900">Analytics</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard label="Total Jobs" value={0} icon={<Briefcase className="h-5 w-5 text-brand-500" />} />
          <StatsCard label="Total Candidates" value={0} icon={<Users className="h-5 w-5 text-indigo-500" />} />
          <StatsCard label="Hired" value={0} icon={<CheckCircle2 className="h-5 w-5 text-green-500" />} />
          <StatsCard label="Completed" value={0} icon={<Clock className="h-5 w-5 text-amber-500" />} />
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16">
          <p className="text-lg font-medium text-neutral-700">No data yet</p>
          <p className="mt-1 text-sm text-neutral-400">Analytics will appear once your organization is set up and candidates flow in.</p>
        </div>
      </div>
    )
  }

  // Aggregate stats
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const { count: totalCandidates } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const { count: hiredCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'hired')

  const { count: completedCount } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'completed')

  // Funnel data
  const statuses = ['invited', 'in_progress', 'completed', 'hired']
  const funnelData: FunnelStage[] = []
  for (const status of statuses) {
    const { count } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', status)
    funnelData.push({
      stage: status.replace('_', ' '),
      count: count ?? 0,
    })
  }

  // Score distribution
  const { data: allCandidates } = await supabase
    .from('candidates')
    .select('overall_score')
    .eq('organization_id', orgId)
    .not('overall_score', 'is', null)

  const scoreBuckets: ScoreDistributionBucket[] = [
    { range: '0-20', count: 0 },
    { range: '21-40', count: 0 },
    { range: '41-60', count: 0 },
    { range: '61-80', count: 0 },
    { range: '81-100', count: 0 },
  ]
  ;(allCandidates ?? []).forEach((c: { overall_score: number | null }) => {
    const s = c.overall_score ?? 0
    if (s <= 20) scoreBuckets[0].count++
    else if (s <= 40) scoreBuckets[1].count++
    else if (s <= 60) scoreBuckets[2].count++
    else if (s <= 80) scoreBuckets[3].count++
    else scoreBuckets[4].count++
  })

  // Source breakdown
  const { data: sourceCandidates } = await supabase
    .from('candidates')
    .select('source')
    .eq('organization_id', orgId)

  const sourceMap: Record<string, number> = {}
  ;(sourceCandidates ?? []).forEach((c: { source: string }) => {
    sourceMap[c.source] = (sourceMap[c.source] || 0) + 1
  })
  const sourceData: SourceBreakdown[] = Object.entries(sourceMap).map(
    ([source, count]) => ({ source, count })
  )

  // Time to hire (avg days from created_at to updated_at for hired candidates)
  const { data: hiredCandidates } = await supabase
    .from('candidates')
    .select('created_at, updated_at')
    .eq('organization_id', orgId)
    .eq('status', 'hired')

  let avgDays = 0
  if (hiredCandidates && hiredCandidates.length > 0) {
    const total = hiredCandidates.reduce((sum: number, c: { created_at: string; updated_at: string }) => {
      const diff =
        new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()
      return sum + diff / (1000 * 60 * 60 * 24)
    }, 0)
    avgDays = Math.round(total / hiredCandidates.length)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-900">Analytics</h1>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          label="Total Jobs"
          value={totalJobs ?? 0}
          icon={<Briefcase className="h-5 w-5 text-brand-500" />}
        />
        <StatsCard
          label="Total Candidates"
          value={totalCandidates ?? 0}
          icon={<Users className="h-5 w-5 text-indigo-500" />}
        />
        <StatsCard
          label="Hired"
          value={hiredCount ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
        />
        <StatsCard
          label="Completed"
          value={completedCount ?? 0}
          icon={<Clock className="h-5 w-5 text-amber-500" />}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelChart data={funnelData} />
        <ScoreDistribution data={scoreBuckets} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SourcePieChart data={sourceData} />
        <TimeToHireCard avgDays={avgDays} />
      </div>
    </div>
  )
}
