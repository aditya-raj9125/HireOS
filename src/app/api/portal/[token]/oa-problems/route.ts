import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  // Validate token
  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('candidate_id, job_id, jobs(pipeline_v2)')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Get OA round config
  const pipeline = (invite as { jobs?: { pipeline_v2?: { rounds?: Record<string, unknown>[] } } }).jobs?.pipeline_v2
  const oaRound = pipeline?.rounds?.find(
    (r: Record<string, unknown>) => r.type === 'online_assessment',
  ) as { preferredTopics?: string[]; questionDifficulty?: string } | undefined

  const preferredTopics = oaRound?.preferredTopics || []
  const difficulty = oaRound?.questionDifficulty || 'medium'

  // Fetch from oa_problems: org-specific + shared bank
  const { data: orgData } = await supabase
    .from('jobs')
    .select('organization_id')
    .eq('id', invite.job_id)
    .single()

  const orgId = orgData?.organization_id

  let query = supabase.from('oa_problems').select('*')

  // Filter by org (org-specific + shared bank where org_id is null)
  if (orgId) {
    query = query.or(`organization_id.eq.${orgId},organization_id.is.null`)
  } else {
    query = query.is('organization_id', null)
  }

  // Filter by difficulty distribution
  if (difficulty !== 'adaptive') {
    query = query.eq('difficulty', difficulty)
  }

  const { data: problems, error: problemsError } = await query

  if (problemsError) {
    return NextResponse.json({ error: 'Failed to fetch problems' }, { status: 500 })
  }

  if (!problems || problems.length === 0) {
    return NextResponse.json({ problems: [] })
  }

  // Filter by topic overlap if preferred topics exist
  let filtered = problems
  if (preferredTopics.length > 0) {
    const topicMatched = problems.filter((p: { topics?: string[] }) =>
      p.topics?.some((t: string) => preferredTopics.includes(t)),
    )
    // If we have enough topic-matched problems, use those; otherwise use all
    if (topicMatched.length >= 5) {
      filtered = topicMatched
    }
  }

  // Seeded randomization using candidate ID
  const seed = hashString(invite.candidate_id)
  filtered = seededShuffle(filtered, seed)

  // Sanitize: strip correct answers and hidden test cases
  const sanitized = filtered.map((p: Record<string, unknown>) => ({
    id: p.id,
    type: p.type,
    difficulty: p.difficulty,
    topics: p.topics,
    title: p.title,
    description: p.description,
    options: p.options, // Keep options for MCQ
    starter_code: p.starter_code,
    test_cases: Array.isArray(p.test_cases)
      ? (p.test_cases as { isHidden?: boolean }[]).filter((tc) => !tc.isHidden)
      : [],
    estimated_minutes: p.estimated_minutes,
  }))

  return NextResponse.json({ problems: sanitized })
}

// Simple hash for seeded randomization
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

// Fisher-Yates shuffle with seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const shuffled = [...arr]
  let m = shuffled.length
  let s = seed

  while (m) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const i = s % m--
    ;[shuffled[m], shuffled[i]] = [shuffled[i], shuffled[m]]
  }

  return shuffled
}
