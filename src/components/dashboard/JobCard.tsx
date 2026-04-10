'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { JobWithStats } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { formatDate, formatScore } from '@/lib/utils'
import { MapPin, Clock, Users } from 'lucide-react'

interface JobCardProps {
  job: JobWithStats
}

const statusVariant: Record<string, 'success' | 'warning' | 'default' | 'info'> = {
  active: 'success',
  draft: 'default',
  paused: 'warning',
  closed: 'default',
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link href={`/dashboard/jobs/${job.id}`}>
      <Card hover className="h-full transition-shadow">
        <div className="flex items-center gap-2">
          {job.department && (
            <Badge variant="teal">{job.department}</Badge>
          )}
          <Badge variant={statusVariant[job.status] ?? 'default'}>
            {job.status}
          </Badge>
        </div>

        <h3 className="mt-3 text-lg font-medium text-neutral-900">
          {job.title}
        </h3>

        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {job.job_type.replace('_', '-')}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3 text-sm text-neutral-600">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {job.candidateCount} Candidates
          </span>
          <span className="text-neutral-300">·</span>
          <span>Avg Score: {formatScore(job.avgScore)}</span>
        </div>

        {/* Funnel progress */}
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-neutral-100">
            <div
              className="h-1.5 rounded-full bg-brand-500"
              style={{
                width: `${Math.min(
                  (job.candidateCount / Math.max(job.target_headcount, 1)) *
                    100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-xs text-neutral-400">
            Created {formatDate(job.created_at)}
          </span>
          <span className="text-xs font-medium text-brand-500">
            View Pipeline →
          </span>
        </div>
      </Card>
    </Link>
  )
}
