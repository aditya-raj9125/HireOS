// ============================================================
// HireOS — LLM Router
// All LLM calls go through Cloudflare Workers AI.
// ============================================================

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface LLMOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  preferFastModel?: boolean
  timeoutMs?: number
}

interface ToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface LatencyRecord {
  ttft: number
  timestamp: number
}

// Fast model for real-time scoring and quick decisions
const CF_FAST_MODEL = '@cf/meta/llama-3.1-8b-instruct'
// Smart model for conversation, evaluation and tool calling
const CF_SMART_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
// Tool-calling capable model
const CF_TOOL_MODEL = '@cf/meta/llama-3.1-70b-instruct'

export class LLMRouter {
  private cfAccountId: string
  private cfToken: string
  private cfGatewayUrl?: string
  private latencyLog: LatencyRecord[] = []

  constructor(config: {
    cloudflareAccountId: string
    cloudflareAIToken: string
    cloudflareAIGatewayUrl?: string
  }) {
    this.cfAccountId = config.cloudflareAccountId
    this.cfToken = config.cloudflareAIToken
    this.cfGatewayUrl = config.cloudflareAIGatewayUrl
  }

  /**
   * Standard streaming completion via Cloudflare Workers AI.
   */
  async *complete(
    messages: Message[],
    options: LLMOptions = {},
  ): AsyncIterable<string> {
    const { maxTokens = 1024, temperature = 0.7, systemPrompt, preferFastModel = false, timeoutMs = 30000 } = options

    const allMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages

    const model = preferFastModel ? CF_FAST_MODEL : CF_SMART_MODEL
    const url = this.buildUrl(model)
    const start = performance.now()
    let firstToken = true

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: allMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`[LLMRouter] Cloudflare Workers AI returned ${res.status}: ${body}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('[LLMRouter] No response body')

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const token = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? ''
          if (token) {
            if (firstToken) {
              this.latencyLog.push({ ttft: performance.now() - start, timestamp: Date.now() })
              firstToken = false
            }
            yield token
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }
  }

  /**
   * Completion with tool calling via Cloudflare Workers AI.
   * Uses llama-3.1-70b which supports function calling.
   */
  async completeWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMOptions = {},
  ): Promise<{ text: string; toolCalls: { name: string; input: Record<string, unknown> }[] }> {
    const { maxTokens = 2048, temperature = 0.3, systemPrompt, timeoutMs = 30000 } = options

    const allMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages

    // Convert Anthropic-style input_schema to OpenAI-style parameters
    const cfTools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))

    const url = this.buildUrl(CF_TOOL_MODEL)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: allMessages,
        tools: cfTools,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`[LLMRouter] Cloudflare Workers AI returned ${res.status}: ${body}`)
    }

    const data = await res.json() as {
      result: {
        response?: string
        tool_calls?: { name: string; arguments: Record<string, unknown> }[]
      }
    }

    const text = data.result?.response ?? ''
    const toolCalls = (data.result?.tool_calls ?? []).map((tc) => ({
      name: tc.name,
      input: tc.arguments,
    }))

    return { text, toolCalls }
  }

  /**
   * Get latency statistics for recent calls.
   */
  getLatencyStats(): { p50: number; p95: number } {
    const recent = this.latencyLog
      .filter((r) => Date.now() - r.timestamp < 60 * 60 * 1000)
      .map((r) => r.ttft)
      .sort((a, b) => a - b)
    return {
      p50: percentile(recent, 50),
      p95: percentile(recent, 95),
    }
  }

  // ─── Private ────────────────────────────────────────────

  private buildUrl(model: string): string {
    if (this.cfGatewayUrl) {
      // AI Gateway URL format: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/workers-ai/{model}
      return `${this.cfGatewayUrl}/${model}`
    }
    return `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/${model}`
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}
