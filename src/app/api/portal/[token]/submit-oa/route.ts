import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  // Validate token
  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('candidate_id, job_id')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await req.json()
  const { mcqAnswers, codeSubmissions, roundNumber, timeSpentPerQuestion } = body

  // ── Grade MCQ ─────────────────────────────────────────────
  let mcqScore = 0
  let mcqTotal = 0

  if (mcqAnswers && typeof mcqAnswers === 'object') {
    const problemIds = Object.keys(mcqAnswers)
    if (problemIds.length > 0) {
      const { data: problems } = await supabase
        .from('oa_problems')
        .select('id, correct_option_id')
        .in('id', problemIds)

      if (problems) {
        mcqTotal = problems.length
        for (const problem of problems) {
          if (mcqAnswers[problem.id] === problem.correct_option_id) {
            mcqScore++
          }
        }
      }
    }
  }

  // ── Grade Coding ──────────────────────────────────────────
  let codingScore = 0
  let codingTotal = 0
  const codeResults: Record<string, { passed: number; total: number }> = {}

  if (Array.isArray(codeSubmissions)) {
    for (const submission of codeSubmissions) {
      const { problemId, code, language } = submission

      // Fetch all test cases including hidden
      const { data: problem } = await supabase
        .from('oa_problems')
        .select('test_cases')
        .eq('id', problemId)
        .single()

      if (!problem) continue

      const testCases = problem.test_cases as { input: string; expected: string; isHidden?: boolean }[]
      codingTotal++

      // Execute in sandbox
      const sandboxUrl = process.env.SANDBOX_SERVICE_URL
      if (sandboxUrl) {
        try {
          const res = await fetch(`${sandboxUrl}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              language,
              testCases: testCases.map((tc) => ({ input: tc.input, expected: tc.expected })),
              timeoutMs: 10000,
            }),
            signal: AbortSignal.timeout(15000),
          })

          if (res.ok) {
            const result = await res.json()
            const passed = result.results?.filter((r: { passed: boolean }) => r.passed).length || 0
            const total = testCases.length
            codeResults[problemId] = { passed, total }
            if (passed === total) codingScore++
          }
        } catch (err) {
          console.error(`Sandbox execution failed for problem ${problemId}:`, (err as Error).message)
          codeResults[problemId] = { passed: 0, total: testCases.length }
        }
      } else {
        // No sandbox — mark as unable to grade
        codeResults[problemId] = { passed: 0, total: testCases.length }
      }
    }
  }

  // ── Combined Score ────────────────────────────────────────
  const mcqWeight = 0.4
  const codingWeight = 0.6
  const mcqPercent = mcqTotal > 0 ? (mcqScore / mcqTotal) * 100 : 0
  const codingPercent = codingTotal > 0 ? (codingScore / codingTotal) * 100 : 0
  const combinedScore = Math.round(mcqPercent * mcqWeight + codingPercent * codingWeight)

  // ── Write round_results ───────────────────────────────────
  await supabase.from('round_results').upsert({
    candidate_id: invite.candidate_id,
    job_id: invite.job_id,
    round_number: roundNumber || 1,
    round_type: 'online_assessment',
    status: 'completed',
    score: combinedScore,
    transcript: [
      { role: 'system', text: `MCQ: ${mcqScore}/${mcqTotal}`, timestamp: Date.now() },
      { role: 'system', text: `Coding: ${codingScore}/${codingTotal}`, timestamp: Date.now() },
    ],
    adaptive_difficulty_log: timeSpentPerQuestion ? [{ timeSpent: timeSpentPerQuestion }] : [],
  })

  // ── Check auto-advance rules ──────────────────────────────
  const { data: job } = await supabase
    .from('jobs')
    .select('pipeline_v2')
    .eq('id', invite.job_id)
    .single()

  const pipeline = job?.pipeline_v2 as { rounds?: { autoAdvanceThreshold?: number; autoRejectThreshold?: number }[] } | undefined
  const roundConfig = pipeline?.rounds?.[((roundNumber || 1) - 1)]
  const advanceThreshold = roundConfig?.autoAdvanceThreshold ?? 70
  const rejectThreshold = roundConfig?.autoRejectThreshold ?? 30

  let newStatus: string | null = null
  if (combinedScore >= advanceThreshold) {
    newStatus = 'advanced'
  } else if (combinedScore < rejectThreshold) {
    newStatus = 'rejected'
  }

  if (newStatus) {
    await supabase
      .from('candidates')
      .update({ status: newStatus })
      .eq('id', invite.candidate_id)
  }

  return NextResponse.json({
    ok: true,
    score: combinedScore,
    mcq: { score: mcqScore, total: mcqTotal },
    coding: { score: codingScore, total: codingTotal, results: codeResults },
    recommendation: combinedScore >= advanceThreshold ? 'advance' : combinedScore < rejectThreshold ? 'reject' : 'hold',
  })
}
