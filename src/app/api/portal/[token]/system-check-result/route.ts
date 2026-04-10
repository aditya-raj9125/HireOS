import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

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
  const { sessionId, cameraResult, micResult, networkResult, browserResult, overallPass } = body

  const { error: insertError } = await supabase.from('system_check_results').insert({
    candidate_id: invite.candidate_id,
    session_id: sessionId || '',
    camera_result: cameraResult || {},
    mic_result: micResult || {},
    network_result: networkResult || {},
    browser_result: browserResult || {},
    overall_pass: overallPass ?? false,
  })

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save check results' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
