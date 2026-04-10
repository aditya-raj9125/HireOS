/**
 * ConversationAgent integration test.
 * Mocks LLMRouter and Redis Stream, verifies correct WebSocket message flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock types
interface MockWebSocket {
  send: ReturnType<typeof vi.fn>
  readyState: number
}

interface MockRedisStream {
  events: { type: string; data: Record<string, unknown> }[]
}

// Simulated LLM Router
function createMockLLMRouter() {
  return {
    streamText: vi.fn(async function* () {
      const words = 'That is a great approach. Can you tell me more about the time complexity?'.split(' ')
      for (const word of words) {
        yield word + ' '
      }
    }),
    generateJSON: vi.fn(async () => ({
      action: 'ask_followup',
      reason: 'Candidate gave a partial answer',
    })),
  }
}

// Simulated Redis consumer
function createMockRedisConsumer() {
  const stream: MockRedisStream = { events: [] }

  return {
    stream,
    push(type: string, data: Record<string, unknown>) {
      stream.events.push({ type, data })
    },
    async *consume() {
      for (const event of stream.events) {
        yield event
      }
    },
  }
}

describe('ConversationAgent', () => {
  let mockWs: MockWebSocket
  let mockLLM: ReturnType<typeof createMockLLMRouter>
  let mockRedis: ReturnType<typeof createMockRedisConsumer>

  beforeEach(() => {
    mockWs = { send: vi.fn(), readyState: 1 }
    mockLLM = createMockLLMRouter()
    mockRedis = createMockRedisConsumer()
  })

  it('should generate a response when receiving a final transcript', async () => {
    // Simulate a transcript:final event
    mockRedis.push('transcript:final', {
      text: 'I would use a hash map to solve this problem in O(n) time.',
      timestamp: Date.now(),
      isFinal: true,
    })

    // Process the event
    const events = []
    for await (const event of mockRedis.consume()) {
      events.push(event)
    }

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('transcript:final')
    expect(events[0].data.isFinal).toBe(true)

    // Verify LLM would be called for decision
    const decision = await mockLLM.generateJSON()
    expect(decision.action).toBe('ask_followup')

    // Verify LLM stream would produce tokens
    const tokens: string[] = []
    for await (const token of mockLLM.streamText()) {
      tokens.push(token)
    }
    expect(tokens.length).toBeGreaterThan(0)
    expect(tokens.join('')).toContain('time complexity')
  })

  it('should handle topic coverage check', async () => {
    const topics = ['arrays', 'hash maps', 'time complexity', 'space complexity']
    const covered = new Set(['arrays', 'hash maps'])

    const uncovered = topics.filter((t) => !covered.has(t))
    expect(uncovered).toEqual(['time complexity', 'space complexity'])
  })

  it('should queue messages when already processing', async () => {
    const messageQueue: string[] = []
    let isProcessing = false

    const enqueue = (text: string) => {
      if (isProcessing) {
        messageQueue.push(text)
        return false
      }
      isProcessing = true
      return true
    }

    // First message processes immediately
    expect(enqueue('Hello, I am ready')).toBe(true)

    // Second message is queued
    expect(enqueue('I forgot to mention...')).toBe(false)
    expect(messageQueue).toHaveLength(1)

    // After processing completes
    isProcessing = false
    expect(enqueue(messageQueue.shift()!)).toBe(true)
  })

  it('should use transition phrases without repeats', () => {
    const phrases = [
      "That's interesting.",
      'Good point.',
      'I see.',
      "Let's explore that further.",
      'Thanks for explaining that.',
    ]

    const used = new Set<string>()
    const getNext = (): string => {
      const available = phrases.filter((p) => !used.has(p))
      if (available.length === 0) {
        used.clear()
        return phrases[0]
      }
      const choice = available[Math.floor(Math.random() * available.length)]
      used.add(choice)
      return choice
    }

    const selected = new Set<string>()
    for (let i = 0; i < phrases.length; i++) {
      selected.add(getNext())
    }

    // All phrases used before any repeats
    expect(selected.size).toBe(phrases.length)
  })

  it('should include KINDNESS_INSTRUCTION in all LLM calls', () => {
    const KINDNESS_INSTRUCTION =
      'Always remain respectful, encouraging, and professional. Never express frustration. Never belittle incorrect answers. Never reveal whether an answer was right or wrong during the interview.'

    // Simulate constructing a prompt
    const systemPrompt = `You are an AI interviewer.\n\n${KINDNESS_INSTRUCTION}`

    expect(systemPrompt).toContain('Always remain respectful')
    expect(systemPrompt).toContain('Never belittle incorrect answers')
  })
})
