import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { StatsCard } from '@/components/dashboard/StatsCard'
import { RecentJobsTable } from '@/components/dashboard/RecentJobsTable'
import { RecentCandidatesTable } from '@/components/dashboard/RecentCandidatesTable'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  Briefcase,
  Users,
  BarChart3,
  Clock,
  Plus,
  Upload,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Use service role to avoid RLS recursion on profiles
  const service = createServiceRoleClient()
  const { data: profile } = await service
    .from('profiles')
    .select('organization_id, full_name')
    .eq('id', user?.id ?? '')
    .single()

  const orgId = profile?.organization_id

  // Fetch stats
  const { count: activeJobsCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId ?? '')
    .eq('status', 'active')

  const { count: totalCandidates } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId ?? '')

  const { data: completedCandidates } = await supabase
    .from('candidates')
    .select('id')
    .eq('organization_id', orgId ?? '')
    .in('status', ['completed', 'hired'])

  const completionRate =
    totalCandidates && totalCandidates > 0
      ? Math.round(
          ((completedCandidates?.length ?? 0) / totalCandidates) * 100
        )
      : 0

  // Fetch recent jobs (last 5)
  const { data: recentJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('organization_id', orgId ?? '')
    .order('created_at', { ascending: false })
    .limit(5)

  // Fetch recent candidates (last 5)
  const { data: recentCandidates } = await supabase
    .from('candidates')
    .select('*')
    .eq('organization_id', orgId ?? '')
    .order('created_at', { ascending: false })
    .limit(5)

  const greeting = getGreeting()

  return (
    <div>
      {/* Greeting */}
      <h2 className="text-2xl font-medium text-neutral-900">
        {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Here&apos;s what&apos;s happening with your hiring pipeline.
      </p>

      {/* Stats grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Active Jobs"
          value={activeJobsCount ?? 0}
          icon={<Briefcase className="h-5 w-5 text-brand-500" />}
        />
        <StatsCard
          label="Total Candidates"
          value={totalCandidates ?? 0}
          icon={<Users className="h-5 w-5 text-indigo-500" />}
        />
        <StatsCard
          label="Completion Rate"
          value={`${completionRate}%`}
          icon={<BarChart3 className="h-5 w-5 text-amber-500" />}
        />
        <StatsCard
          label="Avg. Time to Hire"
          value="—"
          icon={<Clock className="h-5 w-5 text-brand-500" />}
        />
      </div>

      {/* Two column grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Recent Jobs — 60% */}
        <Card className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-neutral-900">
              Recent Jobs
            </h3>
            <Link href="/dashboard/jobs">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          <RecentJobsTable jobs={recentJobs ?? []} />
        </Card>

        {/* Quick Actions — 40% */}
        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-base font-medium text-neutral-900">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <Link href="/dashboard/jobs/new" className="block">
              <button className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                  <Plus className="h-4 w-4 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    Post New Job
                  </p>
                  <p className="text-xs text-neutral-400">
                    Create a new open role
                  </p>
                </div>
              </button>
            </Link>
            <button className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
                <Upload className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Import Candidates
                </p>
                <p className="text-xs text-neutral-400">
                  Bulk upload via CSV
                </p>
              </div>
            </button>
            <Link href="/dashboard/analytics" className="block">
              <button className="flex w-full items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    View Analytics
                  </p>
                  <p className="text-xs text-neutral-400">
                    Pipeline insights & reports
                  </p>
                </div>
              </button>
            </Link>
          </div>

          {/* Recent Candidates below */}
          <div className="mt-6 border-t border-neutral-200 pt-4">
            <h3 className="mb-3 text-base font-medium text-neutral-900">
              Recent Candidates
            </h3>
            <RecentCandidatesTable candidates={recentCandidates ?? []} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
