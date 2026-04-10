'use client'

import Link from 'next/link'
import type { Job } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import { JOB_STATUS_COLORS } from '@/lib/constants'
import { useRouter } from 'next/navigation'

interface RecentJobsTableProps {
  jobs: Job[]
}

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
  active: 'success',
  draft: 'default',
  paused: 'warning',
  closed: 'default',
}

export function RecentJobsTable({ jobs }: RecentJobsTableProps) {
  const router = useRouter()

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs yet"
        description="Create your first role to start hiring."
        action={{
          label: 'Create Job',
          onClick: () => router.push('/dashboard/jobs/new'),
        }}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-3 text-left font-medium text-neutral-500">
              Job Title
            </th>
            <th className="pb-3 text-left font-medium text-neutral-500">
              Status
            </th>
            <th className="hidden pb-3 text-left font-medium text-neutral-500 sm:table-cell">
              Department
            </th>
            <th className="hidden pb-3 text-left font-medium text-neutral-500 md:table-cell">
              Created
            </th>
            <th className="pb-3 text-right font-medium text-neutral-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-b border-neutral-100 last:border-0"
            >
              <td className="py-3">
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="font-medium text-neutral-900 hover:text-brand-600"
                >
                  {job.title}
                </Link>
              </td>
              <td className="py-3">
                <Badge variant={statusVariant[job.status] ?? 'default'}>
                  {job.status}
                </Badge>
              </td>
              <td className="hidden py-3 text-neutral-500 sm:table-cell">
                {job.department || '—'}
              </td>
              <td className="hidden py-3 text-neutral-500 md:table-cell">
                {formatDate(job.created_at)}
              </td>
              <td className="py-3 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                >
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
