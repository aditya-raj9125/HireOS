import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('candidate_id')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const url = new URL(_req.url)
  const sessionId = url.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const { data: checkpoint } = await supabase
    .from('interview_checkpoints')
    .select('*')
    .eq('session_id', sessionId)
    .eq('candidate_id', invite.candidate_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!checkpoint) {
    return NextResponse.json({ checkpoint: null })
  }

  return NextResponse.json({ checkpoint: checkpoint.checkpoint_data })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('candidate_id')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await req.json()
  const { sessionId, checkpointData } = body

  if (!sessionId || !checkpointData) {
    return NextResponse.json({ error: 'sessionId and checkpointData required' }, { status: 400 })
  }

  // Upsert: delete old checkpoints for this session, insert new one
  await supabase
    .from('interview_checkpoints')
    .delete()
    .eq('session_id', sessionId)
    .eq('candidate_id', invite.candidate_id)

  const { error: insertError } = await supabase.from('interview_checkpoints').insert({
    session_id: sessionId,
    candidate_id: invite.candidate_id,
    checkpoint_data: checkpointData,
  })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save checkpoint' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
