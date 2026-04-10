import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { nanoid } from 'nanoid'
import { inviteSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Validation failed' },
      { status: 400 }
    )
  }

  const { candidate_id, job_id } = parsed.data

  // Verify candidate belongs to a job the user has access to
  const { data: candidate } = await supabase
    .from('candidates')
    .select('id, job_id')
    .eq('id', candidate_id)
    .eq('job_id', job_id)
    .single()

  if (!candidate) {
    return NextResponse.json(
      { error: 'Candidate not found' },
      { status: 404 }
    )
  }

  const token = nanoid(32)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // 7-day expiry

  const { data, error } = await supabase
    .from('candidate_invites')
    .insert({
      candidate_id,
      job_id,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
