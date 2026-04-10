import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(request: Request) {
  const body = await request.json()
  const { token, sessionId, type } = body

  if (!token || !sessionId || !type) {
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
  const candidateId = invite.candidate_id
  const jobId = invite.job_id

  // Construct R2 key
  const r2Key = `recordings/${orgId}/${jobId}/${candidateId}/${sessionId}/${type}.webm`

  // Call Cloudflare Worker to create multipart upload
  const cfWorkersUrl = process.env.CLOUDFLARE_WORKERS_URL
  if (!cfWorkersUrl) {
    return NextResponse.json({ error: 'Recording service not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${cfWorkersUrl}/r2/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ r2Key }),
    })

    if (!res.ok) {
      throw new Error(`Worker returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json({ ...data, r2Key })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to create presigned upload', detail: (err as Error).message },
      { status: 500 },
    )
  }
}
