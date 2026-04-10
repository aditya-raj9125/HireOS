// ============================================================
// HireOS — Proctor Agent
// Subscribes to proctor events, builds integrity report,
// scores severity, clusters events, and compiles HR report.
// ============================================================

import type Redis from 'ioredis'

// ─── Types ──────────────────────────────────────────────────

type ProctorEventType =
  | 'face_missing'
  | 'multiple_faces'
  | 'gaze_off_screen'
  | 'tab_switch'
  | 'window_blur'
  | 'copy_paste'
  | 'phone_detected'
  | 'second_voice'
  | 'screen_record_attempt'

interface ProctorEvent {
  type: ProctorEventType
  detail: string
  timestamp: number
  severity: 'low' | 'medium' | 'high'
}

interface ScoredEvent extends ProctorEvent {
  deduction: number
  scoreAfter: number
  clusterId: number
}

interface ProctorReport {
  integrityScore: number
  events: ScoredEvent[]
  eventBreakdown: Record<string, { count: number; totalDeduction: number }>
  recommendation: string
  recommendationTier: 'no_concerns' | 'minor_flags' | 'multiple_flags' | 'serious_concerns'
}

// ─── Severity Config ────────────────────────────────────────

const SEVERITY_DEDUCTIONS: Record<ProctorEventType, { first: number; repeated: number }> = {
  face_missing: { first: 2, repeated: 5 },
  multiple_faces: { first: 10, repeated: 10 },
  gaze_off_screen: { first: 1, repeated: 3 },
  tab_switch: { first: 5, repeated: 5 },
  window_blur: { first: 3, repeated: 3 },
  copy_paste: { first: 8, repeated: 8 },
  phone_detected: { first: 15, repeated: 15 },
  second_voice: { first: 12, repeated: 12 },
  screen_record_attempt: { first: 20, repeated: 20 },
}

const EVENT_CLUSTER_WINDOW_MS = 10_000 // 10 seconds

// ─── Agent ──────────────────────────────────────────────────

export class ProctorAgent {
  private sessionId: string
  private redis: Redis
  private integrityScore = 100
  private events: ScoredEvent[] = []
  private eventCounts = new Map<ProctorEventType, number>()
  private lastEventByType = new Map<ProctorEventType, number>() // timestamp
  private clusterCounter = 0
  private streamListenerActive = false
  private stopped = false

  constructor(config: { sessionId: string; redis: Redis }) {
    this.sessionId = config.sessionId
    this.redis = config.redis
  }

  async start(): Promise<void> {
    this.streamListenerActive = true
    this.listenToStream()
  }

  stop(): void {
    this.stopped = true
    this.streamListenerActive = false
  }

  getIntegrityScore(): number {
    return Math.max(0, this.integrityScore)
  }

  // ─── Event Processing ─────────────────────────────────────

  private processEvent(event: ProctorEvent): void {
    const type = event.type
    const lastTime = this.lastEventByType.get(type) ?? 0
    const timeSinceLast = event.timestamp - lastTime

    // Event clustering: same type within 10s = same incident
    if (timeSinceLast < EVENT_CLUSTER_WINDOW_MS && lastTime > 0) {
      // Part of existing cluster — don't count as separate violation
      return
    }

    // Determine if first or repeated
    const count = this.eventCounts.get(type) ?? 0
    const deductions = SEVERITY_DEDUCTIONS[type] || { first: 2, repeated: 5 }
    const deduction = count === 0 ? deductions.first : deductions.repeated

    this.integrityScore = Math.max(0, this.integrityScore - deduction)
    this.eventCounts.set(type, count + 1)
    this.lastEventByType.set(type, event.timestamp)
    this.clusterCounter++

    const scoredEvent: ScoredEvent = {
      ...event,
      deduction,
      scoreAfter: this.integrityScore,
      clusterId: this.clusterCounter,
    }

    this.events.push(scoredEvent)
  }

  // ─── Report Generation ────────────────────────────────────

  generateReport(): ProctorReport {
    const score = this.getIntegrityScore()

    // Build breakdown
    const breakdown: Record<string, { count: number; totalDeduction: number }> = {}
    for (const event of this.events) {
      if (!breakdown[event.type]) {
        breakdown[event.type] = { count: 0, totalDeduction: 0 }
      }
      breakdown[event.type].count++
      breakdown[event.type].totalDeduction += event.deduction
    }

    // Determine recommendation tier
    let recommendationTier: ProctorReport['recommendationTier']
    let recommendation: string

    if (score > 80) {
      recommendationTier = 'no_concerns'
      recommendation = 'No integrity concerns detected. The interview proceeded normally.'
    } else if (score > 60) {
      recommendationTier = 'minor_flags'
      recommendation = `Minor flags detected (integrity score: ${score}/100). Recommend brief review of flagged moments.`
    } else if (score > 40) {
      recommendationTier = 'multiple_flags'
      recommendation = `Multiple integrity flags detected (integrity score: ${score}/100). Strong review recommended. Check recording at flagged timestamps.`
    } else {
      recommendationTier = 'serious_concerns'
      recommendation = `Serious integrity concerns (integrity score: ${score}/100). Multiple violations detected. Recommend reviewing full recording before making hiring decision.`
    }

    return {
      integrityScore: score,
      events: [...this.events],
      eventBreakdown: breakdown,
      recommendation,
      recommendationTier,
    }
  }

  // ─── Redis Stream Listener ────────────────────────────────

  private async listenToStream(): Promise<void> {
    const streamKey = `interview:${this.sessionId}:events`
    const group = 'agents'
    const consumer = 'proctor'

    try {
      await this.redis.xgroup('CREATE', streamKey, group, '0', 'MKSTREAM')
    } catch {
      // Already exists
    }

    while (this.streamListenerActive && !this.stopped) {
      try {
        const results = await this.redis.xreadgroup(
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

            if (type === 'proctor:event') {
              const parsed = JSON.parse(data) as ProctorEvent
              this.processEvent(parsed)
            }

            await this.redis.xack(streamKey, group, id)
          }
        }
      } catch (err) {
        if (this.stopped) break
        console.error('[ProctorAgent] Stream read error:', (err as Error).message)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }
}
