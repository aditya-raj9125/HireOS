'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { formatDate, formatScore } from '@/lib/utils'
import { Search, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Candidate } from '@/types'

const statusVariant: Record<
  string,
  'success' | 'warning' | 'danger' | 'info' | 'teal' | 'default'
> = {
  invited: 'info',
  in_progress: 'teal',
  completed: 'success',
  rejected: 'danger',
  hired: 'success',
  on_hold: 'warning',
}

const statusTabs = ['all', 'invited', 'in_progress', 'completed', 'hired', 'rejected'] as const

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<(Candidate & { job_title?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.organization_id) {
      setLoading(false)
      return
    }

    let query = supabase
      .from('candidates')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: false })

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query

    // Fetch job titles for each candidate
    const jobIds = [...new Set((data ?? []).map((c) => c.job_id))]
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, title')
      .in('id', jobIds.length > 0 ? jobIds : [''])

    const jobMap = new Map((jobs ?? []).map((j) => [j.id, j.title]))

    setCandidates(
      (data ?? []).map((c) => ({
        ...c,
        job_title: jobMap.get(c.job_id) ?? 'Unknown',
      }))
    )
    setLoading(false)
  }, [supabase, statusFilter])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  const filtered = candidates.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.job_title ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Candidates</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Input
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={Search}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {statusTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              {tab === 'all' ? 'All' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8 text-neutral-300" />}
            title="No candidates found"
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Add candidates to your jobs to see them here.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-3 text-left font-medium text-neutral-500">Name</th>
                  <th className="hidden pb-3 text-left font-medium text-neutral-500 sm:table-cell">Job</th>
                  <th className="hidden pb-3 text-left font-medium text-neutral-500 md:table-cell">Status</th>
                  <th className="hidden pb-3 text-left font-medium text-neutral-500 lg:table-cell">Score</th>
                  <th className="hidden pb-3 text-left font-medium text-neutral-500 lg:table-cell">Source</th>
                  <th className="hidden pb-3 text-left font-medium text-neutral-500 xl:table-cell">Applied</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                    onClick={() => router.push(`/dashboard/jobs/${c.job_id}`)}
                  >
                    <td className="py-3">
                      <p className="font-medium text-neutral-900">{c.full_name}</p>
                      <p className="text-xs text-neutral-400">{c.email}</p>
                    </td>
                    <td className="hidden py-3 text-neutral-700 sm:table-cell">
                      {c.job_title}
                    </td>
                    <td className="hidden py-3 md:table-cell">
                      <Badge variant={statusVariant[c.status] ?? 'default'}>
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="hidden py-3 text-neutral-700 lg:table-cell">
                      {formatScore(c.overall_score)}
                    </td>
                    <td className="hidden py-3 text-neutral-500 lg:table-cell capitalize">
                      {c.source}
                    </td>
                    <td className="hidden py-3 text-neutral-500 xl:table-cell">
                      {formatDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
