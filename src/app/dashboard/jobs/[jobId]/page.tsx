import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { JobDetailHeader } from '@/components/dashboard/JobDetailHeader'
import { CandidatePipelineView } from '@/components/dashboard/CandidatePipelineView'
import type { Job, CandidateWithRounds, Candidate, RoundResult, CandidateInvite } from '@/types'

interface Props {
  params: Promise<{ jobId: string }>
}

export default async function JobDetailPage({ params }: Props) {
  const { jobId } = await params
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch job
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) redirect('/dashboard/jobs')

  // Fetch candidates for this job
  const { data: candidates } = await supabase
    .from('candidates')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  // Fetch round results for all candidates
  const candidateIds = (candidates ?? []).map((c: Candidate) => c.id)
  let roundResults: RoundResult[] = []
  let invites: CandidateInvite[] = []

  if (candidateIds.length > 0) {
    const { data: results } = await supabase
      .from('round_results')
      .select('*')
      .in('candidate_id', candidateIds)

    roundResults = (results ?? []) as RoundResult[]

    const { data: inviteData } = await supabase
      .from('candidate_invites')
      .select('*')
      .in('candidate_id', candidateIds)

    invites = (inviteData ?? []) as CandidateInvite[]
  }

  // Assemble CandidateWithRounds
  const candidatesWithRounds: CandidateWithRounds[] = (
    (candidates ?? []) as Candidate[]
  ).map((c) => ({
    ...c,
    rounds: roundResults.filter((r) => r.candidate_id === c.id),
    invite: invites.find((i) => i.candidate_id === c.id) ?? null,
  }))

  const typedJob = job as Job

  return (
    <div className="space-y-8">
      <JobDetailHeader job={typedJob} />
      <CandidatePipelineView
        jobId={jobId}
        candidates={candidatesWithRounds}
        rounds={typedJob.pipeline_config.rounds}
      />
    </div>
  )
}
