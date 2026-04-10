import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  // Fetch all data in parallel
  const [candidateRes, roundResultsRes, recordingsRes, invitesRes] = await Promise.all([
    supabase
      .from('candidates')
      .select('*, organizations(name)')
      .eq('id', id)
      .single(),
    supabase
      .from('round_results')
      .select('*')
      .eq('candidate_id', id)
      .order('round_number', { ascending: true }),
    supabase
      .from('recording_files')
      .select('*')
      .eq('candidate_id', id),
    supabase
      .from('candidate_invites')
      .select('*, jobs(id, title, department, pipeline_v2, scoring_rubric, organization_id)')
      .eq('candidate_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  if (candidateRes.error || !candidateRes.data) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  const candidate = candidateRes.data
  const roundResults = roundResultsRes.data || []
  const recordings = recordingsRes.data || []
  const invite = invitesRes.data
  const job = invite?.jobs

  // Generate presigned R2 read URLs for recordings
  const cfWorkersUrl = process.env.CLOUDFLARE_WORKERS_URL
  const recordingsWithUrls = recordings.map((rec: Record<string, unknown>) => ({
    ...rec,
    url: cfWorkersUrl ? `${cfWorkersUrl}/r2/read/${rec.r2_key}` : null,
  }))

  // Calculate percentile rank if we have a job
  let percentileRank = 0
  if (job?.id) {
    const { data: allResults } = await supabase
      .from('round_results')
      .select('candidate_id, score')
      .eq('job_id', job.id)
      .eq('status', 'completed')
      .not('score', 'is', null)

    if (allResults && allResults.length > 1) {
      // Average score per candidate
      const scoreMap = new Map<string, number[]>()
      for (const r of allResults) {
        if (!scoreMap.has(r.candidate_id)) scoreMap.set(r.candidate_id, [])
        scoreMap.get(r.candidate_id)!.push(r.score ?? 0)
      }

      const avgScores = Array.from(scoreMap.entries()).map(([cid, scores]) => ({
        candidateId: cid,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))

      avgScores.sort((a, b) => a.avg - b.avg)

      const myIndex = avgScores.findIndex((s) => s.candidateId === id)
      if (myIndex >= 0) {
        percentileRank = Math.round(((myIndex + 1) / avgScores.length) * 100)
      }
    }
  }

  // Build overall recommendation
  const completedRounds = roundResults.filter((r: { status: string }) => r.status === 'completed')
  const avgScore =
    completedRounds.length > 0
      ? Math.round(
          completedRounds.reduce((sum: number, r: { score?: number }) => sum + (r.score || 0), 0) /
            completedRounds.length,
        )
      : 0

  const overallRecommendation =
    avgScore >= 70 ? 'advance' : avgScore >= 40 ? 'hold' : 'reject'

  // Assemble round reports with associated recordings
  const roundReports = roundResults.map((round: Record<string, unknown>) => {
    const roundRecordings = recordingsWithUrls.filter(
      (rec: { session_id: unknown }) => rec.session_id === round.session_id,
    )

    return {
      ...round,
      recordings: roundRecordings,
      percentileRank,
    }
  })

  const report = {
    candidate: {
      id: candidate.id,
      fullName: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone,
      status: candidate.status,
      organization: (candidate as { organizations?: { name: string } }).organizations?.name,
    },
    job: job
      ? {
          id: job.id,
          title: job.title,
          department: job.department,
          scoringRubric: job.scoring_rubric,
        }
      : null,
    rounds: roundReports,
    overallScore: avgScore,
    overallRecommendation,
    percentileRank,
    completedRoundsCount: completedRounds.length,
    totalRoundsCount: job?.pipeline_v2?.rounds?.length || 0,
  }

  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'private, max-age=30',
    },
  })
}
