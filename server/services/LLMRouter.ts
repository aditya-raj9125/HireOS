// ============================================================
// HireOS — LLM Router
// All LLM calls go through this router. Cloudflare first, Anthropic fallback.
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
  provider: 'cloudflare' | 'anthropic'
  ttft: number // time to first token
  timestamp: number
}

const CF_FAST_MODEL = '@cf/meta/llama-3.1-8b-instruct'
const CF_SMART_MODEL = '@cf/meta/llama-3.1-70b-instruct'
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250514'

export class LLMRouter {
  private cfAccountId: string
  private cfToken: string
  private cfGatewayUrl?: string
  private anthropicKey: string
  private latencyLog: LatencyRecord[] = []

  constructor(config: {
    cloudflareAccountId: string
    cloudflareAIToken: string
    cloudflareAIGatewayUrl?: string
    anthropicApiKey: string
  }) {
    this.cfAccountId = config.cloudflareAccountId
    this.cfToken = config.cloudflareAIToken
    this.cfGatewayUrl = config.cloudflareAIGatewayUrl
    this.anthropicKey = config.anthropicApiKey
  }

  /**
   * Standard completion. Returns full text or streams tokens.
   */
  async *complete(
    messages: Message[],
    options: LLMOptions = {},
  ): AsyncIterable<string> {
    const { maxTokens = 1024, temperature = 0.7, systemPrompt, preferFastModel = false, timeoutMs = 5000 } = options

    const allMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages

    // Try Cloudflare first
    try {
      const start = performance.now()
      let firstToken = true
      const model = preferFastModel ? CF_FAST_MODEL : CF_SMART_MODEL

      const cfUrl = this.cfGatewayUrl
        ? `${this.cfGatewayUrl}/run/${model}`
        : `https://api.cloudflare.com/client/v4/accounts/${this.cfAccountId}/ai/run/${model}`

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      const res = await fetch(cfUrl, {
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
        throw new Error(`Cloudflare returned ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            const token = parsed.response || parsed.choices?.[0]?.delta?.content || ''
            if (token) {
              if (firstToken) {
                this.latencyLog.push({
                  provider: 'cloudflare',
                  ttft: performance.now() - start,
                  timestamp: Date.now(),
                })
                firstToken = false
              }
              yield token
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
      return
    } catch (err) {
      // Cloudflare failed — fall through to Anthropic
      console.warn('[LLMRouter] Cloudflare failed, falling back to Anthropic:', (err as Error).message)
    }

    // Anthropic fallback
    yield* this.anthropicStream(allMessages, maxTokens, temperature, timeoutMs * 4)
  }

  /**
   * Completion with tool calling support.
   */
  async completeWithTools(
    messages: Message[],
    tools: ToolDefinition[],
    options: LLMOptions = {},
  ): Promise<{ text: string; toolCalls: { name: string; input: Record<string, unknown> }[] }> {
    const { maxTokens = 2048, temperature = 0.3, systemPrompt, timeoutMs = 20000 } = options

    // Tool calling uses Anthropic directly (better tool support)
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const system = systemPrompt || messages.find((m) => m.role === 'system')?.content || ''

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: anthropicMessages,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema,
        })),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      throw new Error(`Anthropic returned ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    const text = data.content
      ?.filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text)
      .join('') || ''

    const toolCalls = data.content
      ?.filter((c: { type: string }) => c.type === 'tool_use')
      .map((c: { name: string; input: Record<string, unknown> }) => ({
        name: c.name,
        input: c.input,
      })) || []

    return { text, toolCalls }
  }

  /**
   * Get latency statistics for recent calls.
   */
  getLatencyStats(): { cloudflare: { p50: number; p95: number }; anthropic: { p50: number; p95: number } } {
    const recent = this.latencyLog.filter((r) => Date.now() - r.timestamp < 60 * 60 * 1000)

    const cfTimes = recent.filter((r) => r.provider === 'cloudflare').map((r) => r.ttft).sort((a, b) => a - b)
    const anTimes = recent.filter((r) => r.provider === 'anthropic').map((r) => r.ttft).sort((a, b) => a - b)

    return {
      cloudflare: {
        p50: percentile(cfTimes, 50),
        p95: percentile(cfTimes, 95),
      },
      anthropic: {
        p50: percentile(anTimes, 50),
        p95: percentile(anTimes, 95),
      },
    }
  }

  // ─── Private ────────────────────────────────────────────

  private async *anthropicStream(
    messages: Message[],
    maxTokens: number,
    temperature: number,
    timeoutMs: number,
  ): AsyncIterable<string> {
    const start = performance.now()
    let firstToken = true

    const system = messages.find((m) => m.role === 'system')?.content || ''
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: anthropicMessages,
        stream: true,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      throw new Error(`Anthropic returned ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6).trim()
        if (!data || data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            if (firstToken) {
              this.latencyLog.push({
                provider: 'anthropic',
                ttft: performance.now() - start,
                timestamp: Date.now(),
              })
              firstToken = false
            }
            yield parsed.delta.text
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}
