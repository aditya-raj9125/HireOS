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
    .select('*, candidates(*), jobs(*, organizations(id))')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  const body = await req.json()
  const { roundNumber } = body

  if (!roundNumber || typeof roundNumber !== 'number') {
    return NextResponse.json({ error: 'roundNumber is required' }, { status: 400 })
  }

  // Check if this round is already completed
  const { data: existingResult } = await supabase
    .from('round_results')
    .select('id, status')
    .eq('candidate_id', invite.candidate_id)
    .eq('job_id', invite.job_id)
    .eq('round_number', roundNumber)
    .single()

  if (existingResult?.status === 'completed') {
    return NextResponse.json({ error: 'This round has already been completed' }, { status: 409 })
  }

  // Generate session ID
  const sessionId = `session_${invite.candidate_id}_${invite.job_id}_r${roundNumber}_${Date.now()}`

  // Get round config from pipeline_v2
  const pipeline = invite.jobs?.pipeline_v2 as { rounds?: Record<string, unknown>[] } | undefined
  const roundConfig = pipeline?.rounds?.[roundNumber - 1] || {}

  // Create or update round_results row
  if (existingResult) {
    await supabase
      .from('round_results')
      .update({
        session_id: sessionId,
        started_at: new Date().toISOString(),
        status: 'in_progress',
      })
      .eq('id', existingResult.id)
  } else {
    await supabase.from('round_results').insert({
      candidate_id: invite.candidate_id,
      job_id: invite.job_id,
      round_number: roundNumber,
      round_type: (roundConfig as { type?: string }).type || 'telephonic_screen',
      session_id: sessionId,
      started_at: new Date().toISOString(),
      status: 'in_progress',
    })
  }

  // Initialize Durable Object if Cloudflare Worker is configured
  const cfWorkersUrl = process.env.CLOUDFLARE_WORKERS_URL
  if (cfWorkersUrl) {
    try {
      await fetch(`${cfWorkersUrl}/session/${sessionId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          candidateId: invite.candidate_id,
          jobId: invite.job_id,
          roundType: (roundConfig as { type?: string }).type || 'telephonic_screen',
          roundNumber,
          durationSeconds: ((roundConfig as { durationMinutes?: number }).durationMinutes || 30) * 60,
          mustCoverRemaining: (roundConfig as { mustCoverTopics?: string[] }).mustCoverTopics || [],
        }),
      })
    } catch (err) {
      console.error('Failed to init Durable Object:', (err as Error).message)
    }
  }

  const wsUrl = process.env.INTERVIEW_WS_URL || 'ws://localhost:3001'

  return NextResponse.json({
    sessionId,
    wsUrl: `${wsUrl}/ws/interview/${sessionId}`,
    roundConfig,
    roundNumber,
  })
}
