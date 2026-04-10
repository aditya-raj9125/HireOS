// ============================================================
// HireOS — Code Watcher Agent
// Monitors live coding in real time via Redis stream, detects
// structural patterns, and triggers contextual follow-ups.
// ============================================================

import type Redis from 'ioredis'
import type { LLMRouter } from '../services/LLMRouter'
import { CodeAnalysisEngine, type CodeAnalysis } from '../services/CodeAnalysisEngine'

// ─── Types ──────────────────────────────────────────────────

export type CodeFollowUpTrigger =
  | 'nested_loops'
  | 'brute_force_complete'
  | 'no_edge_cases'
  | 'recursion_no_memo'
  | 'test_case_failed'
  | 'copy_paste_detected'
  | 'solution_correct'
  | 'stuck_3min'
  | 'algorithm_switch'

interface TriggerEvent {
  trigger: CodeFollowUpTrigger
  context: string
  timestamp: number
}

interface CodeWatcherConfig {
  sessionId: string
  redis: Redis
  llmRouter: LLMRouter
  problemStatement?: string
}

// ─── Template Questions ─────────────────────────────────────

const TRIGGER_TEMPLATES: Record<CodeFollowUpTrigger, string> = {
  nested_loops:
    'I notice you have nested loops here. Can you walk me through the time complexity of this approach? Is there a way to optimize it?',
  brute_force_complete:
    'Great, your solution passes the tests. The current approach looks like it might be O(n²). Can you think of a more efficient approach?',
  no_edge_cases:
    'Your main logic looks good. What happens if the input is empty, or contains only one element? Do you want to add any edge case handling?',
  recursion_no_memo:
    'I see you\'re using recursion here. Have you considered whether there are overlapping subproblems? Would memoization help?',
  test_case_failed:
    'That test case didn\'t pass. Can you trace through your logic with that specific input and see where the output diverges from expected?',
  copy_paste_detected:
    'I noticed a large block of code appeared at once. Can you walk me through this section and explain your reasoning?',
  solution_correct:
    'Nice work, all tests pass! Can you analyze the time and space complexity of your solution?',
  stuck_3min:
    'It looks like you might be thinking through something. Would you like to talk through your approach? Sometimes explaining it helps clarify the path forward.',
  algorithm_switch:
    'I see you\'ve changed your approach. What made you decide to switch strategies? What wasn\'t working with the previous approach?',
}

// ─── Rate Limiter ───────────────────────────────────────────

const RATE_LIMIT_MS = 90_000 // 90 seconds between follow-ups

// ─── Agent ──────────────────────────────────────────────────

export class CodeWatcherAgent {
  private config: CodeWatcherConfig
  private engine: CodeAnalysisEngine
  private previousAnalysis: CodeAnalysis | null = null
  private previousCode = ''
  private previousCodeTimestamp = 0
  private triggeredSet = new Set<CodeFollowUpTrigger>()
  private lastTriggerTime = 0
  private lastCodeUpdateTime = 0
  private stuckTimer: ReturnType<typeof setTimeout> | null = null
  private streamListenerActive = false
  private stopped = false
  private testResults: { passed: boolean; input: string; expected: string; actual: string }[] = []

  constructor(config: CodeWatcherConfig) {
    this.config = config
    this.engine = new CodeAnalysisEngine()
  }

  async start(): Promise<void> {
    this.streamListenerActive = true
    this.listenToStream()
  }

  stop(): void {
    this.stopped = true
    this.streamListenerActive = false
    if (this.stuckTimer) clearTimeout(this.stuckTimer)
  }

  // ─── Event Handlers ───────────────────────────────────────

  private async onCodeUpdate(code: string, language: string): Promise<void> {
    const now = Date.now()

    // Paste detection: >80 chars diff in <100ms since last update
    const diffLength = Math.abs(code.length - this.previousCode.length)
    const timeSinceLast = now - this.previousCodeTimestamp
    const isPaste = diffLength > 80 && timeSinceLast < 100

    // Analyze code
    const analysis = this.engine.analyze(code, language)
    analysis.isPastedCode = isPaste

    // Detect algorithm switch: >60% code deleted and new code started
    const isAlgorithmSwitch =
      this.previousCode.length > 50 &&
      code.length > 20 &&
      code.length < this.previousCode.length * 0.4

    // Check triggers
    const triggers: TriggerEvent[] = []

    if (isPaste) {
      triggers.push({
        trigger: 'copy_paste_detected',
        context: code.slice(-500),
        timestamp: now,
      })
    }

    if (isAlgorithmSwitch) {
      triggers.push({
        trigger: 'algorithm_switch',
        context: code.slice(-500),
        timestamp: now,
      })
    }

    if (this.previousAnalysis) {
      // Nested loops newly appeared
      if (analysis.hasNestedLoops && !this.previousAnalysis.hasNestedLoops) {
        triggers.push({
          trigger: 'nested_loops',
          context: code.slice(-500),
          timestamp: now,
        })
      }

      // Recursion without memoization
      if (
        analysis.recursionDepth > 0 &&
        this.previousAnalysis.recursionDepth === 0 &&
        analysis.algorithmFamily !== 'dynamic_programming'
      ) {
        triggers.push({
          trigger: 'recursion_no_memo',
          context: code.slice(-500),
          timestamp: now,
        })
      }

      // No edge cases — first time code reaches reasonable length
      if (
        analysis.problemProgress >= 0.6 &&
        this.previousAnalysis.problemProgress < 0.6 &&
        !analysis.hasEdgeCaseChecks
      ) {
        triggers.push({
          trigger: 'no_edge_cases',
          context: code.slice(-500),
          timestamp: now,
        })
      }
    }

    // Save state
    this.previousAnalysis = analysis
    this.previousCode = code
    this.previousCodeTimestamp = now
    this.lastCodeUpdateTime = now

    // Reset stuck timer on any code update
    this.resetStuckTimer()

    // Emit triggers (rate-limited)
    for (const event of triggers) {
      await this.emitTrigger(event)
    }
  }

  private async onTestResult(results: { passed: boolean; input: string; expected: string; actual: string }[]): Promise<void> {
    this.testResults = results

    const allPassed = results.every((r) => r.passed)
    const anyFailed = results.some((r) => !r.passed)

    if (allPassed && this.previousAnalysis) {
      // Check if brute force
      if (
        this.previousAnalysis.algorithmFamily === 'brute_force' ||
        (this.previousAnalysis.hasNestedLoops && this.previousAnalysis.timeComplexityHint.time.includes('n²'))
      ) {
        await this.emitTrigger({
          trigger: 'brute_force_complete',
          context: this.previousCode.slice(-500),
          timestamp: Date.now(),
        })
      } else {
        await this.emitTrigger({
          trigger: 'solution_correct',
          context: this.previousCode.slice(-500),
          timestamp: Date.now(),
        })
      }
    } else if (anyFailed) {
      const failedCase = results.find((r) => !r.passed)
      await this.emitTrigger({
        trigger: 'test_case_failed',
        context: `Input: ${failedCase?.input}, Expected: ${failedCase?.expected}, Got: ${failedCase?.actual}`,
        timestamp: Date.now(),
      })
    }
  }

  // ─── Trigger Emission ────────────────────────────────────

  private async emitTrigger(event: TriggerEvent): Promise<void> {
    // Skip already-triggered
    if (this.triggeredSet.has(event.trigger)) return

    // Rate limit
    if (Date.now() - this.lastTriggerTime < RATE_LIMIT_MS) return

    this.triggeredSet.add(event.trigger)
    this.lastTriggerTime = Date.now()

    // Personalize the question using LLM
    const personalizedQuestion = await this.personalizeQuestion(event.trigger, event.context)

    // Emit to Redis stream for ConversationAgent to pick up
    const streamKey = `interview:${this.config.sessionId}:events`
    await this.config.redis.xadd(
      streamKey,
      '*',
      'type',
      'code:followup:trigger',
      'data',
      JSON.stringify({
        trigger: event.trigger,
        context: event.context,
        question: personalizedQuestion,
      }),
    )
  }

  private async personalizeQuestion(trigger: CodeFollowUpTrigger, codeContext: string): Promise<string> {
    const template = TRIGGER_TEMPLATES[trigger]

    try {
      let result = ''
      for await (const token of this.config.llmRouter.complete(
        [
          {
            role: 'user',
            content: [
              `Rewrite this interview follow-up question so it references the candidate's actual code.`,
              `Template: "${template}"`,
              `Candidate's code (last 500 chars):\n\`\`\`\n${codeContext}\n\`\`\``,
              `Requirements: Reference specific variable names or implementation choices from their code.`,
              `Keep to 1-2 sentences. Be specific but natural. Do NOT reveal the answer.`,
            ].join('\n'),
          },
        ],
        {
          maxTokens: 150,
          temperature: 0.6,
          preferFastModel: true,
          timeoutMs: 3000,
        },
      )) {
        result += token
      }

      return result.trim() || template
    } catch {
      // Fallback to template
      return template
    }
  }

  // ─── Stuck Timer ──────────────────────────────────────────

  private resetStuckTimer(): void {
    if (this.stuckTimer) clearTimeout(this.stuckTimer)
    this.stuckTimer = setTimeout(async () => {
      if (this.stopped) return
      await this.emitTrigger({
        trigger: 'stuck_3min',
        context: this.previousCode.slice(-500),
        timestamp: Date.now(),
      })
    }, 3 * 60 * 1000) // 3 minutes
  }

  // ─── Redis Stream Listener ────────────────────────────────

  private async listenToStream(): Promise<void> {
    const streamKey = `interview:${this.config.sessionId}:events`
    const group = 'agents'
    const consumer = 'code_watcher'

    try {
      await this.config.redis.xgroup('CREATE', streamKey, group, '0', 'MKSTREAM')
    } catch {
      // Already exists
    }

    while (this.streamListenerActive && !this.stopped) {
      try {
        const results = await this.config.redis.xreadgroup(
          'GROUP',
          group,
          consumer,
          'COUNT',
          10,
          'BLOCK',
          2000,
          'STREAMS',
          streamKey,
          '>',
        ) as [string, [string, string[]][]][] | null

        if (!results) continue

        for (const [, messages] of results) {
          for (const [id, fields] of messages) {
            const type = fields[fields.indexOf('type') + 1]
            const data = fields[fields.indexOf('data') + 1]

            if (type === 'code:update') {
              const parsed = JSON.parse(data)
              await this.onCodeUpdate(parsed.content, parsed.language)
            } else if (type === 'code:result') {
              const parsed = JSON.parse(data)
              await this.onTestResult(parsed.testResults || [])
            }

            await this.config.redis.xack(streamKey, group, id)
          }
        }
      } catch (err) {
        if (this.stopped) break
        console.error('[CodeWatcherAgent] Stream read error:', (err as Error).message)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
}
