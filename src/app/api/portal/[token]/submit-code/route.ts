import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceRoleClient()

  // Validate token
  const { data: invite, error } = await supabase
    .from('candidate_invites')
    .select('candidate_id, job_id')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const body = await req.json()
  const { code, language, problemId, sessionId } = body

  if (!code || !language || !problemId) {
    return NextResponse.json({ error: 'code, language, and problemId are required' }, { status: 400 })
  }

  // Fetch all test cases including hidden ones
  const { data: problem } = await supabase
    .from('oa_problems')
    .select('test_cases')
    .eq('id', problemId)
    .single()

  if (!problem) {
    return NextResponse.json({ error: 'Problem not found' }, { status: 404 })
  }

  const testCases = problem.test_cases as { input: string; expected: string; isHidden?: boolean }[]

  // Execute in sandbox
  const sandboxUrl = process.env.SANDBOX_SERVICE_URL
  if (!sandboxUrl) {
    return NextResponse.json({ error: 'Code execution unavailable' }, { status: 503 })
  }

  // Use streaming SSE response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i]

          try {
            const res = await fetch(`${sandboxUrl}/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                language,
                testCases: [{ input: tc.input, expected: tc.expected }],
                timeoutMs: 10000,
              }),
              signal: AbortSignal.timeout(15000),
            })

            if (res.ok) {
              const result = await res.json()
              const testResult = result.results?.[0] || { passed: false, error: 'No result' }

              const sseData = JSON.stringify({
                testCaseIndex: i,
                isHidden: tc.isHidden || false,
                passed: testResult.passed,
                actual: tc.isHidden ? undefined : testResult.actual,
                expected: tc.isHidden ? undefined : tc.expected,
                input: tc.isHidden ? undefined : tc.input,
                executionMs: testResult.executionMs || 0,
                memoryMb: testResult.memoryMb || 0,
                error: testResult.error || null,
              })

              controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
            } else {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ testCaseIndex: i, passed: false, error: 'Execution failed' })}\n\n`,
                ),
              )
            }
          } catch (err) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ testCaseIndex: i, passed: false, error: (err as Error).message })}\n\n`,
              ),
            )
          }
        }

        // Final event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
