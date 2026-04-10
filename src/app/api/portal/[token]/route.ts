import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || token.length < 10) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  // Fetch invite by token
  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json(
      { error: 'Invite not found' },
      { status: 404 }
    )
  }

  // Check expiration
  if (new Date(invite.expires_at) < new Date()) {
    // Update status to expired if not already
    if (invite.status !== 'expired') {
      await supabase
        .from('candidate_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
    }
    return NextResponse.json(
      { error: 'Invite has expired' },
      { status: 410 }
    )
  }

  // Mark as opened if pending
  if (invite.status === 'pending') {
    await supabase
      .from('candidate_invites')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', invite.id)
  }

  // Fetch candidate
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, full_name, email')
    .eq('id', invite.candidate_id)
    .single()

  // Fetch job with org info
  const { data: job } = await supabase
    .from('jobs')
    .select('title, department, pipeline_config, organization_id')
    .eq('id', invite.job_id)
    .single()

  let company = 'Company'
  if (job?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', job.organization_id)
      .single()
    if (org) company = org.name
  }

  return NextResponse.json({
    data: {
      invite: {
        status: invite.status === 'pending' ? 'opened' : invite.status,
        expires_at: invite.expires_at,
      },
      candidate: candidate
        ? { id: candidate.id, full_name: candidate.full_name, email: candidate.email }
        : null,
      job: job
        ? {
            title: job.title,
            department: job.department,
            company,
            pipeline: job.pipeline_config,
          }
        : null,
    },
  })
}
