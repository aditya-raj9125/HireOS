/**
 * SessionRecoveryManager — Client-side checkpoint management for interview session recovery.
 * Saves checkpoints every 90 seconds to sessionStorage + API.
 * On init, loads from API first, then falls back to sessionStorage.
 */

export interface RecoveryContext {
  sessionId: string
  roundType: string
  questionIndex: number
  lastTranscriptEntries: { role: string; text: string; timestamp: number }[]
  currentCode: string | null
  topicsCovered: string[]
  runningScore: number
  timestamp: number
}

export class SessionRecoveryManager {
  private token: string
  private sessionId: string
  private roundType: string
  private intervalId: ReturnType<typeof setInterval> | null = null
  private latestState: Partial<RecoveryContext> = {}

  private static STORAGE_KEY = 'hireos_checkpoint'
  private static INTERVAL_MS = 90_000 // 90 seconds

  constructor(token: string, sessionId: string, roundType: string) {
    this.token = token
    this.sessionId = sessionId
    this.roundType = roundType
  }

  /**
   * Start periodic checkpointing. Call once when the round begins.
   */
  start(): void {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.saveCheckpoint()
    }, SessionRecoveryManager.INTERVAL_MS)
  }

  /**
   * Stop checkpointing (e.g., round ended).
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Update the latest state to be checkpointed on the next cycle.
   */
  updateState(partial: Partial<Omit<RecoveryContext, 'sessionId' | 'roundType' | 'timestamp'>>): void {
    Object.assign(this.latestState, partial)
  }

  /**
   * Attempt to load the most recent checkpoint. API first, sessionStorage fallback.
   */
  async getRecoveryContext(): Promise<RecoveryContext | null> {
    // Try API first
    try {
      const res = await fetch(`/api/portal/${this.token}/checkpoint?sessionId=${this.sessionId}`)
      if (res.ok) {
        const data = await res.json()
        if (data?.checkpoint) {
          return data.checkpoint as RecoveryContext
        }
      }
    } catch {
      // API unavailable, fall through to sessionStorage
    }

    // Fallback to sessionStorage
    try {
      const raw = sessionStorage.getItem(SessionRecoveryManager.STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as RecoveryContext
        if (parsed.sessionId === this.sessionId) {
          return parsed
        }
      }
    } catch {
      // sessionStorage unavailable
    }

    return null
  }

  /**
   * Clear checkpoint after a round is fully completed.
   */
  clearCheckpoint(): void {
    this.stop()
    try {
      sessionStorage.removeItem(SessionRecoveryManager.STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  /**
   * Save a checkpoint to sessionStorage (sync) and API (async, best-effort).
   */
  private saveCheckpoint(): void {
    const checkpoint: RecoveryContext = {
      sessionId: this.sessionId,
      roundType: this.roundType,
      questionIndex: (this.latestState.questionIndex as number) ?? 0,
      lastTranscriptEntries: (this.latestState.lastTranscriptEntries ?? []).slice(-5),
      currentCode: (this.latestState.currentCode as string) ?? null,
      topicsCovered: (this.latestState.topicsCovered as string[]) ?? [],
      runningScore: (this.latestState.runningScore as number) ?? 0,
      timestamp: Date.now(),
    }

    // Synchronous — sessionStorage
    try {
      sessionStorage.setItem(SessionRecoveryManager.STORAGE_KEY, JSON.stringify(checkpoint))
    } catch {
      // quota exceeded or unavailable
    }

    // Async — API (best-effort)
    fetch(`/api/portal/${this.token}/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, checkpoint }),
    }).catch(() => {}) // best-effort
  }
}
