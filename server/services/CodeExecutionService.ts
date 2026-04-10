/**
 * CodeExecutionService — Client for the sandbox /execute endpoint.
 * Implements both batch and streaming execution.
 */

export interface TestCase {
  input: string
  expected: string
}

export interface TestCaseResult {
  testCase: number
  passed: boolean
  input: string
  expected: string
  actual: string
  error: string | null
  timeMs: number
}

export interface ExecutionResult {
  results: TestCaseResult[]
}

const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:4000'
const TOTAL_TIMEOUT_MS = 15_000

export class CodeExecutionService {
  /**
   * Execute code against all test cases. Returns all results at once.
   */
  async execute(
    code: string,
    language: string,
    testCases: TestCase[],
  ): Promise<ExecutionResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)

    try {
      const res = await fetch(`${SANDBOX_URL}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          testCases,
          timeoutMs: TOTAL_TIMEOUT_MS,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(`Sandbox error (${res.status}): ${error}`)
      }

      return (await res.json()) as ExecutionResult
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return {
          results: testCases.map((tc, i) => ({
            testCase: i + 1,
            passed: false,
            input: tc.input,
            expected: tc.expected,
            actual: '',
            error: 'Execution timed out (15s)',
            timeMs: TOTAL_TIMEOUT_MS,
          })),
        }
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Execute code and stream results as each test case completes.
   */
  async *executeStreaming(
    code: string,
    language: string,
    testCases: TestCase[],
  ): AsyncIterable<TestCaseResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)

    try {
      const res = await fetch(`${SANDBOX_URL}/execute/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          language,
          testCases,
          timeoutMs: TOTAL_TIMEOUT_MS,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const error = await res.text()
        throw new Error(`Sandbox error (${res.status}): ${error}`)
      }

      if (!res.body) {
        throw new Error('No response body for streaming execution')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          if (data === '[DONE]') return

          try {
            const result = JSON.parse(data) as TestCaseResult
            yield result
          } catch {
            // skip malformed SSE data
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        yield {
          testCase: 0,
          passed: false,
          input: '',
          expected: '',
          actual: '',
          error: 'Execution timed out (15s)',
          timeMs: TOTAL_TIMEOUT_MS,
        }
      } else {
        throw err
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Health check for the sandbox service.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${SANDBOX_URL}/health`, {
        signal: AbortSignal.timeout(3000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
