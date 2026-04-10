// ============================================================
// HireOS — Evaluation Agent
// Real-time lightweight scoring + final comprehensive scoring.
// Anti-AI-answer detection and bias detection.
// ============================================================

import type Redis from 'ioredis'
import type { LLMRouter } from '../services/LLMRouter'

// ─── Types ──────────────────────────────────────────────────

interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: number
  isFinal: boolean
}

interface RealTimeScores {
  technicalAccuracy: number
  depth: number
  clarity: number
  conciseness: number
}

interface SkillScore {
  skill: string
  weight: number
  score: number
  justification: string
}

interface FinalEvaluation {
  skillScores: SkillScore[]
  notableQuotes: string[]
  recommendation: 'advance' | 'hold' | 'reject'
  executiveSummary: string
  overallScore: number
  antiAiSignals: {
    likelihood: number
    indicators: string[]
  }
  inconsistencies: string[]
  confidence: number
}

interface EvaluationConfig {
  sessionId: string
  redis: Redis
  llmRouter: LLMRouter
  scoringRubric: { skill: string; weight: number; subParameters?: string[] }[]
  mustCoverTopics: string[]
  roundType: string
}

// ─── Agent ──────────────────────────────────────────────────

export class EvaluationAgent {
  private config: EvaluationConfig
  private runningScores: RealTimeScores = {
    technicalAccuracy: 5,
    depth: 5,
    clarity: 5,
    conciseness: 5,
  }
  private scoreHistory: { timestamp: number; scores: RealTimeScores }[] = []
  private transcript: TranscriptEntry[] = []
  private streamListenerActive = false
  private stopped = false

  constructor(config: EvaluationConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    this.streamListenerActive = true
    this.listenToStream()
  }

  stop(): void {
    this.stopped = true
    this.streamListenerActive = false
  }

  getRunningScore(): number {
    const s = this.runningScores
    return Math.round((s.technicalAccuracy + s.depth + s.clarity + s.conciseness) / 4 * 10)
  }

  getRunningScores(): RealTimeScores {
    return { ...this.runningScores }
  }

  // ─── Real-Time Scoring ────────────────────────────────────

  private async scoreRealTime(candidateText: string, aiQuestion: string): Promise<void> {
    const prompt = [
      `Score this interview response on 4 dimensions (1-10 each). Return ONLY valid JSON.`,
      ``,
      `AI Question: "${aiQuestion}"`,
      `Candidate Response: "${candidateText.slice(0, 500)}"`,
      ``,
      `Dimensions:`,
      `- technicalAccuracy: Is the content technically correct?`,
      `- depth: Did they go beyond surface-level?`,
      `- clarity: Was the explanation clear and structured?`,
      `- conciseness: Did they answer without excessive rambling?`,
      ``,
      `Return: {"technicalAccuracy": N, "depth": N, "clarity": N, "conciseness": N}`,
    ].join('\n')

    try {
      let result = ''
      for await (const token of this.config.llmRouter.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 80, temperature: 0.2, preferFastModel: true, timeoutMs: 3000 },
      )) {
        result += token
      }

      const jsonMatch = result.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]) as RealTimeScores
        // Validate number ranges
        for (const key of ['technicalAccuracy', 'depth', 'clarity', 'conciseness'] as const) {
          const val = scores[key]
          if (typeof val === 'number' && val >= 1 && val <= 10) {
            // Exponential moving average
            this.runningScores[key] = 0.65 * this.runningScores[key] + 0.35 * val
          }
        }
        this.scoreHistory.push({ timestamp: Date.now(), scores: { ...this.runningScores } })

        // Persist running score to Redis
        await this.config.redis.hset(
          `session:${this.config.sessionId}`,
          'runningScore',
          String(this.getRunningScore()),
        )
      }
    } catch {
      // Non-critical — skip this scoring round
    }
  }

  // ─── Final Comprehensive Scoring ──────────────────────────

  async runFinalEvaluation(
    fullTranscript: TranscriptEntry[],
    codeSubmission?: { code: string; language: string; testResults: { passed: boolean }[] },
    topicsCovered?: string[],
  ): Promise<FinalEvaluation> {
    const rubric = this.config.scoringRubric
    const mustCover = this.config.mustCoverTopics
    const coveredCount = topicsCovered?.length ?? 0
    const mustCoverCount = mustCover.length

    const transcriptText = fullTranscript
      .filter((t) => t.isFinal)
      .map((t) => `${t.role === 'ai' ? 'Interviewer' : 'Candidate'}: ${t.text}`)
      .join('\n')

    const skillsList = rubric.map((s) => `  - ${s.skill} (weight: ${s.weight}%)`).join('\n')

    const codeContext = codeSubmission
      ? [
          `\nCode Submission (${codeSubmission.language}):`,
          '```',
          codeSubmission.code.slice(0, 2000),
          '```',
          `Test Results: ${codeSubmission.testResults.filter((t) => t.passed).length}/${codeSubmission.testResults.length} passed`,
        ].join('\n')
      : ''

    const evaluationPrompt = [
      `You are a senior technical interviewer evaluating a candidate's ${this.config.roundType} interview.`,
      `Evaluate objectively and thoroughly. Return ONLY valid JSON.`,
      ``,
      `## Scoring Rubric`,
      `Skills to evaluate:`,
      skillsList,
      ``,
      `## Must-Cover Topics`,
      `Required: [${mustCover.join(', ')}]`,
      `Covered: [${topicsCovered?.join(', ') || 'none'}] (${coveredCount}/${mustCoverCount})`,
      ``,
      `## Full Transcript`,
      transcriptText.slice(0, 6000),
      codeContext,
      ``,
      `## Instructions`,
      `Return this exact JSON structure:`,
      `{`,
      `  "skillScores": [{"skill": "...", "weight": N, "score": N (0-100), "justification": "2-3 sentences"}],`,
      `  "notableQuotes": ["quote1", "quote2"] (2-3 revealing candidate quotes),`,
      `  "recommendation": "advance" | "hold" | "reject",`,
      `  "executiveSummary": "150-word summary of performance",`,
      `  "overallScore": N (0-100, weighted average of skills),`,
      `  "inconsistencies": ["any contradictions in answers"],`,
      `  "confidence": N (0.0-1.0, your confidence in this evaluation)`,
      `}`,
    ].join('\n')

    // Use Anthropic direct (higher quality) for final eval
    let evalResult = ''
    try {
      for await (const token of this.config.llmRouter.complete(
        [{ role: 'user', content: evaluationPrompt }],
        {
          maxTokens: 2000,
          temperature: 0.2,
          preferFastModel: false,
          timeoutMs: 30000,
        },
      )) {
        evalResult += token
      }
    } catch (err) {
      console.error('[EvaluationAgent] Final eval LLM failed:', (err as Error).message)
      return this.buildFallbackEvaluation()
    }

    // Parse the evaluation JSON
    try {
      const jsonMatch = evalResult.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')

      const parsed = JSON.parse(jsonMatch[0])

      // Run anti-AI detection
      const antiAiSignals = await this.detectAntiAI(fullTranscript)

      return {
        skillScores: parsed.skillScores || [],
        notableQuotes: parsed.notableQuotes || [],
        recommendation: parsed.recommendation || 'hold',
        executiveSummary: parsed.executiveSummary || '',
        overallScore: parsed.overallScore || this.getRunningScore(),
        antiAiSignals,
        inconsistencies: parsed.inconsistencies || [],
        confidence: parsed.confidence || 0.5,
      }
    } catch (err) {
      console.error('[EvaluationAgent] Failed to parse eval result:', (err as Error).message)
      return this.buildFallbackEvaluation()
    }
  }

  // ─── Anti-AI-Answer Detection ─────────────────────────────

  private async detectAntiAI(
    transcript: TranscriptEntry[],
  ): Promise<{ likelihood: number; indicators: string[] }> {
    const candidateTexts = transcript
      .filter((t) => t.role === 'candidate' && t.isFinal)
      .map((t) => t.text)

    if (candidateTexts.length === 0) return { likelihood: 0, indicators: [] }

    const prompt = [
      `Analyze these candidate responses for patterns suggesting AI-assisted answers.`,
      `Return ONLY valid JSON.`,
      ``,
      `Candidate responses:`,
      candidateTexts.slice(0, 10).map((t, i) => `${i + 1}. "${t.slice(0, 300)}"`).join('\n'),
      ``,
      `Check for:`,
      `- ChatGPT/Claude-like phrases ("certainly", "there are several key factors", "it's worth noting")`,
      `- Unnaturally complete first-probe answers with no hesitation`,
      `- Answers over 300 words without natural pauses or self-correction`,
      `- Perfect terminology with no personal experience anchors`,
      `- Uniform response structure (always listing exactly 3 points)`,
      ``,
      `Return: {"likelihood": N (0.0-1.0), "indicators": ["indicator1", "indicator2"]}`,
    ].join('\n')

    try {
      let result = ''
      for await (const token of this.config.llmRouter.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 200, temperature: 0.1, preferFastModel: false, timeoutMs: 10000 },
      )) {
        result += token
      }

      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          likelihood: Math.max(0, Math.min(1, parsed.likelihood ?? 0)),
          indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
        }
      }
    } catch {
      // Non-critical
    }

    return { likelihood: 0, indicators: [] }
  }

  // ─── Bias Detection ───────────────────────────────────────

  async runBiasCheck(
    evaluation: FinalEvaluation,
    candidateName: string,
  ): Promise<{ flagged: boolean; message: string }> {
    // Anonymize transcript and re-score a subset
    const anonymizedTranscript = this.transcript
      .filter((t) => t.isFinal)
      .slice(0, 5)
      .map((t) => ({
        ...t,
        text: t.text.replace(new RegExp(escapeRegex(candidateName), 'gi'), '[CANDIDATE]'),
      }))

    if (anonymizedTranscript.length < 3) {
      return { flagged: false, message: '' }
    }

    const prompt = [
      `Score this anonymized candidate's technical ability from 0-100 based on these exchanges.`,
      `Return ONLY a number.`,
      ``,
      anonymizedTranscript
        .map((t) => `${t.role === 'ai' ? 'Q' : 'A'}: ${t.text.slice(0, 200)}`)
        .join('\n'),
    ].join('\n')

    try {
      let result = ''
      for await (const token of this.config.llmRouter.complete(
        [{ role: 'user', content: prompt }],
        { maxTokens: 10, temperature: 0, preferFastModel: true, timeoutMs: 3000 },
      )) {
        result += token
      }

      const anonymizedScore = parseInt(result.trim(), 10)
      if (!isNaN(anonymizedScore)) {
        const delta = Math.abs(evaluation.overallScore - anonymizedScore)
        if (delta > 5) {
          return {
            flagged: true,
            message: `Score may be influenced by candidate name. Named score: ${evaluation.overallScore}, Anonymized score: ${anonymizedScore}. Please review.`,
          }
        }
      }
    } catch {
      // Non-critical
    }

    return { flagged: false, message: '' }
  }

  // ─── Redis Stream Listener ────────────────────────────────

  private async listenToStream(): Promise<void> {
    const streamKey = `interview:${this.config.sessionId}:events`
    const group = 'agents'
    const consumer = 'evaluation'

    try {
      await this.config.redis.xgroup('CREATE', streamKey, group, '0', 'MKSTREAM')
    } catch {
      // Already exists
    }

    let lastAiQuestion = ''

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

            if (type === 'transcript:final') {
              const parsed = JSON.parse(data)
              const entry: TranscriptEntry = {
                role: parsed.role || 'candidate',
                text: parsed.text,
                timestamp: Date.now(),
                isFinal: true,
              }
              this.transcript.push(entry)

              // Score candidate responses in real-time
              if (entry.role === 'candidate') {
                await this.scoreRealTime(entry.text, lastAiQuestion)
              } else {
                lastAiQuestion = entry.text
              }
            }

            await this.config.redis.xack(streamKey, group, id)
          }
        }
      } catch (err) {
        if (this.stopped) break
        console.error('[EvaluationAgent] Stream read error:', (err as Error).message)
        await new Promise((r) => setTimeout(r, 1000))
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private buildFallbackEvaluation(): FinalEvaluation {
    const overall = this.getRunningScore()
    return {
      skillScores: this.config.scoringRubric.map((s) => ({
        skill: s.skill,
        weight: s.weight,
        score: overall,
        justification: 'Evaluation based on real-time scoring only (comprehensive evaluation failed).',
      })),
      notableQuotes: [],
      recommendation: overall >= 70 ? 'advance' : overall >= 40 ? 'hold' : 'reject',
      executiveSummary: `Candidate scored ${overall}/100 based on real-time assessment. Full evaluation was unavailable.`,
      overallScore: overall,
      antiAiSignals: { likelihood: 0, indicators: [] },
      inconsistencies: [],
      confidence: 0.3,
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
