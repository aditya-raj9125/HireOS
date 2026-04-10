import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Job } from '@/types'

interface Context {
  params: Promise<{ jobId: string }>
}

export async function GET(_req: NextRequest, { params }: Context) {
  const { jobId } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({ data: data as Job })
}

export async function PATCH(req: NextRequest, { params }: Context) {
  const { jobId } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // Only allow safe fields to be updated
  const allowed: (keyof Job)[] = [
    'title',
    'department',
    'location',
    'job_type',
    'seniority_level',
    'description',
    'required_skills',
    'nice_to_have_skills',
    'status',
    'target_headcount',
    'deadline',
    'pipeline_config',
    'scoring_rubric',
    'auto_advance_rules',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  const { jobId } = await params
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase.from('jobs').delete().eq('id', jobId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: null }, { status: 200 })
}
