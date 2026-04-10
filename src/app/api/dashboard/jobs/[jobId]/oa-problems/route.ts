import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = createServiceRoleClient()

  const { data: problems, error } = await supabase
    .from('oa_problems')
    .select('*')
    .or(`organization_id.eq.(select organization_id from jobs where id = '${jobId}'),organization_id.is.null`)
    .order('created_at', { ascending: false })

  if (error) {
    // Fallback: fetch all shared + try with a direct org lookup
    const { data: job } = await supabase.from('jobs').select('organization_id').eq('id', jobId).single()
    const orgId = job?.organization_id

    const { data: fallbackProblems } = orgId
      ? await supabase.from('oa_problems').select('*').or(`organization_id.eq.${orgId},organization_id.is.null`)
      : await supabase.from('oa_problems').select('*').is('organization_id', null)

    return NextResponse.json({ problems: fallbackProblems || [] })
  }

  return NextResponse.json({ problems: problems || [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = createServiceRoleClient()
  const body = await req.json()

  // Get org ID from job
  const { data: job } = await supabase
    .from('jobs')
    .select('organization_id')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // If a problemId is provided, it's referencing an existing problem
  if (body.problemId) {
    // Verify the problem exists
    const { data: existing } = await supabase
      .from('oa_problems')
      .select('id')
      .eq('id', body.problemId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, problemId: body.problemId })
  }

  // Create a new custom problem  
  const { data: problem, error } = await supabase
    .from('oa_problems')
    .insert({
      organization_id: job.organization_id,
      type: body.type || 'mcq',
      difficulty: body.difficulty || 'medium',
      topics: body.topics || [],
      title: body.title,
      description: body.description,
      options: body.options || null,
      correct_option_id: body.correctOptionId || null,
      starter_code: body.starterCode || null,
      test_cases: body.testCases || [],
      solution_reference: body.solutionReference || null,
      estimated_minutes: body.estimatedMinutes || 10,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create problem' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, problem })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const supabase = createServiceRoleClient()

  const url = new URL(req.url)
  const problemId = url.searchParams.get('problemId')

  if (!problemId) {
    return NextResponse.json({ error: 'problemId required' }, { status: 400 })
  }

  // Get org ID from job
  const { data: job } = await supabase
    .from('jobs')
    .select('organization_id')
    .eq('id', jobId)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Only allow deleting org-specific problems (not shared bank)
  const { error } = await supabase
    .from('oa_problems')
    .delete()
    .eq('id', problemId)
    .eq('organization_id', job.organization_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete problem' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
