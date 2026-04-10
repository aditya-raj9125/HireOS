'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Briefcase,
  MapPin,
  Calendar,
  Users,
  Pencil,
  Pause,
  Play,
  Archive,
} from 'lucide-react'
import type { Job } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  job: Job
}

const JOB_BADGE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  draft: 'default',
  active: 'success',
  paused: 'warning',
  closed: 'default',
}

export function JobDetailHeader({ job }: Props) {
  const badgeVariant = JOB_BADGE_VARIANT[job.status] ?? 'default'

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-neutral-900">
            {job.title}
          </h1>
          <Badge variant={badgeVariant}>
            {job.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
          {job.department && (
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {job.department}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            Headcount: {job.target_headcount}
          </span>
          {job.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Deadline: {formatDate(job.deadline)}
            </span>
          )}
        </div>

        {job.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {job.required_skills.map((skill) => (
              <Badge key={skill} variant="teal" size="sm">
                {skill}
              </Badge>
            ))}
            {job.nice_to_have_skills.map((skill) => (
              <Badge key={skill} variant="purple" size="sm">
                {skill}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" size="sm">
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        {job.status === 'active' ? (
          <Button variant="secondary" size="sm">
            <Pause className="h-3.5 w-3.5" />
            Pause
          </Button>
        ) : job.status === 'paused' ? (
          <Button variant="secondary" size="sm">
            <Play className="h-3.5 w-3.5" />
            Resume
          </Button>
        ) : null}
        <Button variant="ghost" size="sm">
          <Archive className="h-3.5 w-3.5" />
          Close
        </Button>
      </div>
    </div>
  )
}
