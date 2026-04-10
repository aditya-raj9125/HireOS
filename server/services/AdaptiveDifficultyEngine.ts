import { Redis } from 'ioredis'

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

interface ScoreEntry {
  timestamp: number
  rawScore: number
  runningScore: number
  difficulty: DifficultyLevel
}

const DIFFICULTY_INSTRUCTIONS: Record<DifficultyLevel, string> = {
  easy: 'Ask a foundational question testing basic understanding. Use a concrete simple scenario. Avoid jargon. Accept partial answers with probing rather than complete answers.',
  medium: 'Ask a standard question appropriate for the stated seniority level. Expect a complete answer with some depth.',
  hard: 'Ask a challenging question that requires demonstrating trade-off awareness, handling of edge cases, or advanced conceptual depth. A surface answer is not sufficient — probe further.',
}

export class AdaptiveDifficultyEngine {
  private runningScore = 50
  private history: ScoreEntry[] = []
  private sessionId: string
  private redis: Redis

  constructor(sessionId: string, redis: Redis) {
    this.sessionId = sessionId
    this.redis = redis
  }

  /**
   * Update the running performance score using EMA.
   * new_score = 0.65 * old_score + 0.35 * latest_answer_score
   */
  onAnswerScored(score: number): void {
    const clamped = Math.max(0, Math.min(100, score))
    const previousScore = this.runningScore
    this.runningScore = 0.65 * previousScore + 0.35 * clamped

    const entry: ScoreEntry = {
      timestamp: Date.now(),
      rawScore: clamped,
      runningScore: Math.round(this.runningScore * 100) / 100,
      difficulty: this.getCurrentDifficulty(),
    }

    this.history.push(entry)

    // Persist to Redis for session recovery
    this.redis
      .set(
        `adaptive:${this.sessionId}`,
        JSON.stringify({ runningScore: this.runningScore, history: this.history }),
        'EX',
        7200, // 2 hours
      )
      .catch(() => {}) // best-effort persistence
  }

  /**
   * Map running score to difficulty level:
   * below 40 → easy, 40–72 → medium, above 72 → hard
   */
  getCurrentDifficulty(): DifficultyLevel {
    if (this.runningScore < 40) return 'easy'
    if (this.runningScore <= 72) return 'medium'
    return 'hard'
  }

  /**
   * Get an instruction string for the LLM describing what kind of question to ask.
   */
  getNextQuestionInstruction(): string {
    const level = this.getCurrentDifficulty()
    return `[Difficulty: ${level.toUpperCase()} — Running score: ${Math.round(this.runningScore)}] ${DIFFICULTY_INSTRUCTIONS[level]}`
  }

  /**
   * Return the full history of score updates for the adaptive_difficulty_log field.
   */
  log(): ScoreEntry[] {
    return [...this.history]
  }

  /**
   * Restore state from Redis (for session recovery).
   */
  async restore(): Promise<boolean> {
    try {
      const data = await this.redis.get(`adaptive:${this.sessionId}`)
      if (!data) return false

      const parsed = JSON.parse(data) as {
        runningScore: number
        history: ScoreEntry[]
      }

      this.runningScore = parsed.runningScore
      this.history = parsed.history
      return true
    } catch {
      return false
    }
  }

  getRunningScore(): number {
    return Math.round(this.runningScore * 100) / 100
  }
}
