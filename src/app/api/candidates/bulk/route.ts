import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const { data: profile } = await service
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const jobId = formData.get('job_id') as string | null

  if (!file || !jobId) {
    return NextResponse.json(
      { error: 'File and job_id are required' },
      { status: 400 }
    )
  }

  // Verify job ownership
  const { data: job } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const text = await file.text()
  const lines = text.split('\n').filter((line) => line.trim())

  if (lines.length < 2) {
    return NextResponse.json(
      { error: 'CSV must have a header row and at least one data row' },
      { status: 400 }
    )
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const nameIdx = headers.indexOf('full_name')
  const emailIdx = headers.indexOf('email')

  if (nameIdx === -1 || emailIdx === -1) {
    return NextResponse.json(
      { error: 'CSV must have full_name and email columns' },
      { status: 400 }
    )
  }

  const phoneIdx = headers.indexOf('phone')
  const sourceIdx = headers.indexOf('source')

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(',').map((c) => c.trim())
    return {
      organization_id: profile.organization_id,
      job_id: jobId,
      full_name: cols[nameIdx] ?? '',
      email: cols[emailIdx] ?? '',
      phone: phoneIdx !== -1 ? cols[phoneIdx] || null : null,
      source: sourceIdx !== -1 ? cols[sourceIdx] || 'csv_upload' : 'csv_upload',
      status: 'invited' as const,
      current_round: 1,
      parsed_resume: { skills: [], yearsOfExperience: 0, lastRole: '', education: '' },
      tags: [],
    }
  })

  // Filter valid rows
  const validRows = rows.filter((r) => r.full_name && r.email)

  if (validRows.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows found' },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('candidates').insert(validRows)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: validRows.length }, { status: 201 })
}
