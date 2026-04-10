'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { JobWithStats } from '@/types'
import { JobCard } from './JobCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { Search, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface JobsListViewProps {
  initialJobs: JobWithStats[]
}

export function JobsListView({ initialJobs }: JobsListViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()

  const filteredJobs = initialJobs.filter((job) => {
    const matchesSearch = job.title
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium text-neutral-900">Jobs</h1>
        <Link href="/dashboard/jobs/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            Create New Job
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Search jobs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leadingIcon={Search}
          />
        </div>
        <div className="flex gap-2">
          {['all', 'draft', 'active', 'paused', 'closed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs grid */}
      {filteredJobs.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            title="No jobs found"
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your filters.'
                : 'Create your first role to start hiring.'
            }
            action={
              !search && statusFilter === 'all'
                ? {
                    label: 'Create Job',
                    onClick: () => router.push('/dashboard/jobs/new'),
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  )
}
