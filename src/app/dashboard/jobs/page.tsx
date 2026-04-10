import { createServerSupabaseClient } from '@/lib/supabase/server'
import { JobsListView } from '@/components/dashboard/JobsListView'
import type { JobWithStats } from '@/types'

export default async function JobsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user?.id ?? '')
    .single()

  const orgId = profile?.organization_id

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('organization_id', orgId ?? '')
    .order('created_at', { ascending: false })

  // Fetch candidate counts for each job
  const jobsWithStats: JobWithStats[] = await Promise.all(
    (jobs ?? []).map(async (job) => {
      const { count } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)

      const { data: scores } = await supabase
        .from('candidates')
        .select('overall_score')
        .eq('job_id', job.id)
        .not('overall_score', 'is', null)

      const avgScore =
        scores && scores.length > 0
          ? scores.reduce(
              (sum, c) => sum + (Number(c.overall_score) || 0),
              0
            ) / scores.length
          : 0

      const { count: completedCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)
        .in('status', ['completed', 'hired'])

      const totalCount = count ?? 0
      const completionRate =
        totalCount > 0
          ? Math.round(((completedCount ?? 0) / totalCount) * 100)
          : 0

      return {
        ...job,
        candidateCount: totalCount,
        avgScore,
        completionRate,
      }
    })
  )

  return <JobsListView initialJobs={jobsWithStats} />
}
