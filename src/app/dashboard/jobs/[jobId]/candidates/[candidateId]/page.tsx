import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { InviteLink } from '@/components/dashboard/InviteLink'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Tag,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  User,
} from 'lucide-react'
import type { Candidate, Job, RoundResult, CandidateInvite } from '@/types'
import { formatDate, formatScore } from '@/lib/utils'

interface Props {
  params: Promise<{ jobId: string; candidateId: string }>
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

const recommendationIcon = {
  advance: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  hold: <Clock className="h-4 w-4 text-amber-500" />,
  reject: <XCircle className="h-4 w-4 text-red-500" />,
}

export default async function CandidateDetailPage({ params }: Props) {
  const { jobId, candidateId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = createServiceRoleClient()

  // Fetch candidate
  const { data: candidate, error } = await supabase
    .from('candidates')
    .select('*')
    .eq('id', candidateId)
    .eq('job_id', jobId)
    .single()

  if (error || !candidate) redirect(`/dashboard/jobs/${jobId}`)

  const c = candidate as Candidate

  // Fetch job title
  const { data: job } = await service
    .from('jobs')
    .select('title, pipeline_config')
    .eq('id', jobId)
    .single()

  const typedJob = job as Job | null

  // Fetch round results
  const { data: rounds } = await supabase
    .from('round_results')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('round_number', { ascending: true })

  const roundResults = (rounds ?? []) as RoundResult[]

  // Fetch invite
  const { data: invite } = await supabase
    .from('candidate_invites')
    .select('*')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const inv = invite as CandidateInvite | null

  const pipelineRounds = typedJob?.pipeline_config?.rounds ?? []

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back nav */}
      <Link
        href={`/dashboard/jobs/${jobId}`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {typedJob?.title ?? 'Job'}
      </Link>

      {/* Header */}
      <Card>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
              {c.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                {c.full_name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {c.email}
                </span>
                {c.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {c.phone}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Applied {formatDate(c.created_at)}
                </span>
              </div>
              {c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={statusVariant[c.status] ?? 'default'}>
              {c.status.replace('_', ' ')}
            </Badge>
            {c.overall_score !== null && (
              <div className="flex items-center gap-1.5 text-sm">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-semibold text-neutral-900">
                  {formatScore(c.overall_score)}
                </span>
                <span className="text-neutral-400">/ 100</span>
              </div>
            )}
            <span className="text-xs text-neutral-400 capitalize">
              Source: {c.source}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: pipeline progress + round results */}
        <div className="space-y-4 lg:col-span-2">
          {/* Pipeline progress */}
          {pipelineRounds.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="mb-4 text-base font-medium text-neutral-900">
                  Pipeline Progress
                </h2>
                <div className="space-y-3">
                  {pipelineRounds.map((round, i) => {
                    const result = roundResults.find(
                      (r) => r.round_number === round.order
                    )
                    const isCurrent = c.current_round === round.order
                    const isDone = c.current_round > round.order

                    return (
                      <div key={round.id} className="flex items-center gap-3">
                        <div
                          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            isDone
                              ? 'bg-brand-500 text-white'
                              : isCurrent
                              ? 'border-2 border-brand-500 text-brand-600'
                              : 'bg-neutral-100 text-neutral-400'
                          }`}
                        >
                          {isDone ? '✓' : i + 1}
                        </div>
                        <div className="flex flex-1 items-center justify-between">
                          <span
                            className={`text-sm font-medium ${
                              isCurrent
                                ? 'text-neutral-900'
                                : isDone
                                ? 'text-neutral-600'
                                : 'text-neutral-400'
                            }`}
                          >
                            {round.name}
                          </span>
                          {result && (
                            <div className="flex items-center gap-2">
                              {result.score !== null && (
                                <span className="text-sm font-medium text-neutral-700">
                                  {result.score}/{result.max_score}
                                </span>
                              )}
                              {result.recommendation && (
                                <span className="flex items-center gap-1 text-xs capitalize text-neutral-500">
                                  {recommendationIcon[result.recommendation]}
                                  {result.recommendation}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Round results */}
          {roundResults.length > 0 && (
            <Card>
              <div className="p-6">
                <h2 className="mb-4 text-base font-medium text-neutral-900">
                  Round Results
                </h2>
                <div className="space-y-4">
                  {roundResults.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-neutral-200 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-neutral-900 capitalize">
                          Round {r.round_number} — {r.round_type.replace(/_/g, ' ')}
                        </h3>
                        {r.score !== null && (
                          <span className="text-sm font-semibold text-neutral-900">
                            {r.score}/{r.max_score}
                          </span>
                        )}
                      </div>
                      {r.ai_summary && (
                        <p className="mt-2 text-sm text-neutral-600">
                          {r.ai_summary}
                        </p>
                      )}
                      {r.recommendation && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                          {recommendationIcon[r.recommendation]}
                          <span className="capitalize">{r.recommendation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {c.notes && (
            <Card>
              <div className="p-6">
                <h2 className="mb-2 text-base font-medium text-neutral-900">
                  Notes
                </h2>
                <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                  {c.notes}
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Right: invite info + meta */}
        <div className="space-y-4">
          {/* Invite link — always show so HR can generate/copy */}
          <InviteLink
            candidateId={c.id}
            jobId={jobId}
            existingInvite={inv}
          />

          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-medium text-neutral-900">
                Details
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Round</span>
                  <span className="text-neutral-700">
                    {c.current_round > 0
                      ? `${c.current_round} of ${pipelineRounds.length}`
                      : 'Not started'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Score</span>
                  <span className="font-medium text-neutral-700">
                    {formatScore(c.overall_score)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Source</span>
                  <span className="text-neutral-700 capitalize">{c.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Applied</span>
                  <span className="text-neutral-700">{formatDate(c.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Updated</span>
                  <span className="text-neutral-700">{formatDate(c.updated_at)}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
