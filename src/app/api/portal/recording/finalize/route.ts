import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(request: Request) {
  const body = await request.json()
  const { token, r2Key, uploadId, parts, sessionId, candidateId, jobId, type, sizeBytes, durationSeconds } = body

  if (!token || !r2Key || !uploadId || !Array.isArray(parts)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate token
  const { data: invite, error } = await supabase
    .from('invites')
    .select('*, candidates(*, organizations(id))')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const orgId = invite.candidates?.organizations?.id || invite.candidates?.organization_id

  // Complete multipart upload via Cloudflare Worker
  const cfWorkersUrl = process.env.CLOUDFLARE_WORKERS_URL
  if (!cfWorkersUrl) {
    return NextResponse.json({ error: 'Recording service not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${cfWorkersUrl}/r2/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key, uploadId, parts }),
    })

    if (!res.ok) {
      throw new Error(`Worker returned ${res.status}`)
    }

    // Insert recording_files row
    const { error: insertError } = await supabase.from('recording_files').insert({
      session_id: sessionId,
      candidate_id: candidateId || invite.candidate_id,
      job_id: jobId || invite.job_id,
      organization_id: orgId,
      type: type || 'video',
      r2_key: r2Key,
      size_bytes: sizeBytes || 0,
      duration_seconds: durationSeconds || 0,
      status: 'processing',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })

    if (insertError) {
      console.error('Failed to insert recording_files row:', insertError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to finalize upload', detail: (err as Error).message },
      { status: 500 },
    )
  }
}
