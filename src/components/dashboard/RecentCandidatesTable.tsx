'use client'

import Link from 'next/link'
import type { Candidate } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate, formatScore } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface RecentCandidatesTableProps {
  candidates: (Candidate & { job_title?: string })[]
}

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

export function RecentCandidatesTable({
  candidates,
}: RecentCandidatesTableProps) {
  const router = useRouter()

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No candidates yet"
        description="Add candidates to your jobs to start the pipeline."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="pb-3 text-left font-medium text-neutral-500">
              Name
            </th>
            <th className="hidden pb-3 text-left font-medium text-neutral-500 sm:table-cell">
              Status
            </th>
            <th className="hidden pb-3 text-left font-medium text-neutral-500 md:table-cell">
              Score
            </th>
            <th className="hidden pb-3 text-left font-medium text-neutral-500 lg:table-cell">
              Applied
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr
              key={candidate.id}
              className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
              onClick={() =>
                router.push(`/dashboard/jobs/${candidate.job_id}`)
              }
            >
              <td className="py-3">
                <p className="font-medium text-neutral-900">
                  {candidate.full_name}
                </p>
                <p className="text-xs text-neutral-400">{candidate.email}</p>
              </td>
              <td className="hidden py-3 sm:table-cell">
                <Badge variant={statusVariant[candidate.status] ?? 'default'}>
                  {candidate.status.replace('_', ' ')}
                </Badge>
              </td>
              <td className="hidden py-3 text-neutral-700 md:table-cell">
                {formatScore(candidate.overall_score)}
              </td>
              <td className="hidden py-3 text-neutral-500 lg:table-cell">
                {formatDate(candidate.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
