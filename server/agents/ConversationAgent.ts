// ============================================================
// HireOS — Conversation Agent
// Conducts the interview. Subscribes to STT transcripts,
// makes next-action decisions, generates responses, and
// manages topic coverage. Must feel like a real interviewer.
// ============================================================

import type { WebSocket } from 'ws'
import type Redis from 'ioredis'
import type { LLMRouter } from '../services/LLMRouter'
import type { TTSService } from '../services/TTSService'
import { LLMToTTSBridge } from '../services/LLMToTTSBridge'

// ─── Types ──────────────────────────────────────────────────

interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: number
  isFinal: boolean
}

interface AgentDecision {
  action: 'follow_up' | 'next_question' | 'probe_deeper' | 'clarify' | 'wrap_up'
  reasoning: string
}

interface SessionState {
  sessionId: string
  candidateId: string
  jobId: string
  roundType: string
  roundNumber: number
  startedAt: number
  durationSeconds: number
  warningAtSeconds: number
  transcript: TranscriptEntry[]
  questionIndex: number
  questionsAsked: string[]
  topicsCovered: string[]
  mustCoverRemaining: string[]
  runningScore: number
  completed: boolean
}

interface RoundConfig {
  durationMinutes: number
  warningAtMinutes: number
  preferredQuestionCount: number
  preferredTopics: string[]
  mustCoverTopics: string[]
  questionDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive'
  customSystemPrompt: string
  followUpDepth: number
  allowClarifyingQuestions: boolean
}

interface ConversationAgentConfig {
  sessionId: string
  ws: WebSocket
  redis: Redis
  llmRouter: LLMRouter
  ttsService: TTSService
  sessionState: SessionState
  roundConfig: RoundConfig
  systemPrompt: string
  candidateName?: string
  getDifficulty?: () => string
  getDifficultyInstruction?: () => string
}

// ─── Constants ──────────────────────────────────────────────

const DECISION_TIMEOUT_MS = 1500
const THINKING_DELAY_MS = 400 // Artificial delay so AI doesn't feel robotic
const MAX_CONVERSATION_HISTORY = 40 // Messages to keep in LLM context

// Non-negotiable kindness instruction appended to every LLM call
const KINDNESS_INSTRUCTION =
  'Always remain respectful, encouraging, and professional. Never express frustration. ' +
  'Never belittle incorrect answers. Never reveal whether an answer was right or wrong during the interview. ' +
  'Never say "As an AI" or "I\'d be happy to" or any chatbot-like phrase.'

// Transition phrases to rotate (never use the same one twice)
const TRANSITION_PHRASES = [
  "That's a solid point about {topic}.",
  'I see, interesting perspective on {topic}.',
  'Right, that makes sense.',
  'Good, I follow your reasoning.',
  "Thanks for walking me through that.",
  'Okay, I appreciate the detail there.',
  "That's helpful context.",
  'Got it. That covers {topic} well.',
  'Understood, thanks for explaining.',
  "I see what you're getting at.",
  'Right, that lines up.',
  'Fair enough.',
]

// ─── Agent ──────────────────────────────────────────────────

export class ConversationAgent {
  private config: ConversationAgentConfig
  private bridge: LLMToTTSBridge
  private conversationHistory: { role: 'system' | 'user' | 'assistant'; content: string }[] = []
  private usedTransitions = new Set<number>()
  private processing = false
  private pendingTranscripts: string[] = []
  private streamListenerActive = false
  private lastReadId = '$'
  private stopped = false

  constructor(config: ConversationAgentConfig) {
    this.config = config
    this.bridge = new LLMToTTSBridge(config.ttsService, config.ws, config.sessionId)

    // Initialize conversation history with system prompt
    this.conversationHistory.push({
      role: 'system',
      content: config.systemPrompt + '\n\n' + KINDNESS_INSTRUCTION,
    })

    // Add existing transcript to conversation history for recovery
    for (const entry of config.sessionState.transcript) {
      if (entry.isFinal) {
        this.conversationHistory.push({
          role: entry.role === 'ai' ? 'assistant' : 'user',
          content: entry.text,
        })
      }
    }
  }

  /**
   * Start listening for events on the Redis stream.
   */
  async start(): Promise<void> {
    this.streamListenerActive = true

    // Deliver opening greeting
    if (this.config.sessionState.transcript.length === 0) {
      await this.deliverOpening()
    }

    // Listen to Redis stream for transcript events
    this.listenToStream()
  }

  /**
   * Stop the agent gracefully.
   */
  stop(): void {
    this.stopped = true
    this.streamListenerActive = false
  }

  // ─── Core Pipeline ────────────────────────────────────────

  private async deliverOpening(): Promise<void> {
    const name = this.config.candidateName || 'there'
    const roundType = this.config.sessionState.roundType
    const duration = this.config.roundConfig.durationMinutes
    const firstTopic = this.getNextTopic()

    const openingPrompt = [
      `Generate a brief, warm opening for a ${roundType} interview.`,
      `The candidate's name is ${name}. The interview will last ${duration} minutes.`,
      `Introduce yourself as the interviewer, explain the round format briefly,`,
      `ask if the candidate is ready, then ask the first question.`,
      `The first question topic should be: ${firstTopic}.`,
      this.config.getDifficultyInstruction?.() || '',
      `Keep the opening under 4 sentences before the first question.`,
    ].join(' ')

    this.conversationHistory.push({ role: 'user', content: '[SYSTEM: Start interview]' })

    let openingText: string
    try {
      openingText = await this.generateAndSpeak(openingPrompt)
    } catch (err) {
      console.error('[ConversationAgent] Opening LLM call failed:', (err as Error).message)
      // Fall back to a static opening so the UI still shows a question
      openingText = `Welcome${name !== 'there' ? `, ${name}` : ''}! I'm your ${roundType.replace(/_/g, ' ')} interviewer today. We have ${duration} minutes. Let's start — could you walk me through your approach to ${firstTopic}?`
      // Notify client via text too
      this.sendToClient({
        type: 'ai:text',
        payload: { text: openingText, isFinal: true, questionIndex: 1, topic: firstTopic },
      })
    }

    // Populate the Problem Statement / question panel on the client
    this.sendToClient({
      type: 'ai:question',
      payload: {
        questionText: openingText,
        questionIndex: 1,
        topic: firstTopic,
        difficulty: this.config.roundConfig.questionDifficulty,
      },
    })

    this.config.sessionState.questionIndex = 1
  }

  private async onTranscriptFinal(text: string): Promise<void> {
    if (this.stopped || this.config.sessionState.completed) return

    // If already processing, queue
    if (this.processing) {
      this.pendingTranscripts.push(text)
      return
    }

    this.processing = true

    try {
      // Add candidate message to history
      this.conversationHistory.push({ role: 'user', content: text })
      this.config.sessionState.transcript.push({
        role: 'candidate',
        text,
        timestamp: Date.now(),
        isFinal: true,
      })

      // Persist transcript to Redis
      await this.config.redis.hset(
        `session:${this.config.sessionId}`,
        'transcript',
        JSON.stringify(this.config.sessionState.transcript),
      )

      // Send text to client for display
      this.sendToClient({
        type: 'ai:text',
        payload: { text, isFinal: true, questionIndex: this.config.sessionState.questionIndex, topic: '' },
      })

      // Artificial thinking delay
      await delay(THINKING_DELAY_MS + Math.random() * 200)

      // Decide next action
      const decision = await this.decideNextAction()

      // Check topic coverage
      await this.checkTopicCoverage(text)

      // Handle wrap-up
      if (decision.action === 'wrap_up') {
        await this.deliverClosing()
        return
      }

      // Generate response based on decision
      await this.generateResponse(decision)
    } catch (err) {
      console.error('[ConversationAgent] Error processing transcript:', (err as Error).message)
      // Graceful degradation: ask a generic follow-up
      await this.generateAndSpeak('Ask a relevant follow-up question based on the conversation so far.')
    } finally {
      this.processing = false
      // Process queued transcripts
      if (this.pendingTranscripts.length > 0) {
        const next = this.pendingTranscripts.shift()!
        await this.onTranscriptFinal(next)
      }
    }
  }

  private async onCodeFollowUpTrigger(trigger: string, context: string): Promise<void> {
    if (this.stopped || this.processing) return

    this.processing = true
    try {
      await delay(300) // Natural pause

      const prompt = [
        `The code watcher detected: ${trigger}.`,
        `Context from the candidate's code: ${context}`,
        `Generate a brief, specific follow-up question about this observation.`,
        `Reference the candidate's actual code. Keep it to 1-2 sentences.`,
      ].join(' ')

      await this.generateAndSpeak(prompt)
    } finally {
      this.processing = false
    }
  }

  // ─── Decision Engine ──────────────────────────────────────

  private async decideNextAction(): Promise<AgentDecision> {
    const state = this.config.sessionState
    const config = this.config.roundConfig
    const remaining = state.durationSeconds - (Date.now() - state.startedAt) / 1000
    const questionsRemaining = config.preferredQuestionCount - state.questionIndex

    // Fast-path decisions that don't need LLM
    if (remaining < 120 && state.mustCoverRemaining.length === 0) {
      return { action: 'wrap_up', reasoning: 'Time nearly up and all topics covered' }
    }
    if (remaining < 60) {
      return { action: 'wrap_up', reasoning: 'Less than 1 minute remaining' }
    }

    const decisionPrompt = [
      `You are deciding the next action in an interview. Return ONLY valid JSON.`,
      `Questions asked: ${state.questionIndex}/${config.preferredQuestionCount}.`,
      `Topics covered: [${state.topicsCovered.join(', ')}].`,
      `Must-cover remaining: [${state.mustCoverRemaining.join(', ')}].`,
      `Time remaining: ${Math.floor(remaining / 60)} minutes.`,
      `Follow-up depth setting: ${config.followUpDepth}/5.`,
      ``,
      `Last candidate response (summary): "${this.getLastCandidateText().slice(0, 200)}"`,
      ``,
      `Choose one action:`,
      `- "follow_up": ask a follow-up on the same topic (candidate gave partial answer)`,
      `- "next_question": move to a new topic/question`,
      `- "probe_deeper": dig deeper into current topic (follow_up_depth >= 3)`,
      `- "clarify": candidate's answer was unclear, ask for clarification`,
      `- "wrap_up": conclude the interview`,
      ``,
      `Return JSON: {"action": "...", "reasoning": "..."}`,
    ].join('\n')

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), DECISION_TIMEOUT_MS)

      let result = ''
      for await (const token of this.config.llmRouter.complete(
        [{ role: 'user', content: decisionPrompt }],
        {
          maxTokens: 100,
          temperature: 0.3,
          preferFastModel: true,
          timeoutMs: DECISION_TIMEOUT_MS,
        },
      )) {
        result += token
      }
      clearTimeout(timeout)

      // Parse decision JSON
      const jsonMatch = result.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.action && ['follow_up', 'next_question', 'probe_deeper', 'clarify', 'wrap_up'].includes(parsed.action)) {
          return parsed as AgentDecision
        }
      }
    } catch {
      // Timeout or parse error — default to next_question
    }

    // Default: if more topics to cover, next question. Otherwise follow up.
    if (state.mustCoverRemaining.length > 0 || questionsRemaining > 2) {
      return { action: 'next_question', reasoning: 'Default: topics remaining' }
    }
    return { action: 'follow_up', reasoning: 'Default fallback' }
  }

  // ─── Response Generation ──────────────────────────────────

  private async generateResponse(decision: AgentDecision): Promise<void> {
    const state = this.config.sessionState
    let instruction = ''

    switch (decision.action) {
      case 'follow_up':
        instruction = [
          `Acknowledge the candidate's answer briefly (use a unique transition—never repeat yourself).`,
          `Then ask a follow-up question on the same topic to get more depth.`,
          `Keep under 3 sentences total.`,
        ].join(' ')
        break

      case 'next_question': {
        const nextTopic = this.getNextTopic()
        const difficulty = this.config.getDifficultyInstruction?.() || ''
        state.questionIndex++
        instruction = [
          `Briefly acknowledge the candidate's previous answer with a unique transition phrase.`,
          `Then ask the next interview question.`,
          `Topic: ${nextTopic}. ${difficulty}`,
          `Do not repeat any of these already-asked questions: [${state.questionsAsked.join('; ')}].`,
          `Ask exactly ONE question. Do not ask multiple questions at once.`,
        ].join(' ')
        break
      }

      case 'probe_deeper':
        instruction = [
          `The candidate gave an interesting answer. Probe deeper.`,
          `Reference something specific the candidate said.`,
          `Ask them to elaborate on a particular detail, trade-off, or edge case.`,
          `Keep it to 1-2 sentences.`,
        ].join(' ')
        break

      case 'clarify':
        instruction = [
          `The candidate's answer was unclear or incomplete.`,
          `Politely ask for clarification on the specific part that was unclear.`,
          `Rephrase or simplify if needed. Be specific about what you need clarified.`,
        ].join(' ')
        break

      case 'wrap_up':
        await this.deliverClosing()
        return
    }

    await this.generateAndSpeak(instruction)
  }

  private async generateAndSpeak(instruction: string): Promise<string> {
    // Trim conversation history to prevent context overflow
    const trimmedHistory = this.getTrimmedHistory()

    trimmedHistory.push({ role: 'user', content: `[INSTRUCTION]: ${instruction}` })

    const llmStream = this.config.llmRouter.complete(trimmedHistory, {
      maxTokens: 300,
      temperature: 0.7,
      timeoutMs: 5000,
    })

    // Stream through TTS bridge (sub-800ms perceived latency)
    const fullText = await this.bridge.processAndSpeak(llmStream)

    // Store AI response in conversation history and transcript
    this.conversationHistory.push({ role: 'assistant', content: fullText })
    this.config.sessionState.transcript.push({
      role: 'ai',
      text: fullText,
      timestamp: Date.now(),
      isFinal: true,
    })

    // Track question
    if (fullText.includes('?')) {
      this.config.sessionState.questionsAsked.push(fullText.slice(0, 100))
    }

    // Send text to client
    this.sendToClient({
      type: 'ai:text',
      payload: {
        text: fullText,
        isFinal: true,
        questionIndex: this.config.sessionState.questionIndex,
        topic: this.config.sessionState.topicsCovered[this.config.sessionState.topicsCovered.length - 1] || '',
      },
    })

    // Persist
    await this.config.redis.hset(
      `session:${this.config.sessionId}`,
      'transcript',
      JSON.stringify(this.config.sessionState.transcript),
      'questionsAsked',
      JSON.stringify(this.config.sessionState.questionsAsked),
      'questionIndex',
      String(this.config.sessionState.questionIndex),
    )

    return fullText
  }

  private async deliverClosing(): Promise<void> {
    const name = this.config.candidateName || 'there'
    const covered = this.config.sessionState.topicsCovered.slice(0, 3).join(', ') || 'the topics we discussed'

    const closingPrompt = [
      `Generate a professional closing statement for the interview.`,
      `Thank ${name} by name. Briefly mention the topics covered: ${covered}.`,
      `Tell them: "Our team will review your responses and be in touch within 48 hours."`,
      `Wish them well. Keep it to 3-4 sentences. Be warm and genuine.`,
    ].join(' ')

    await this.generateAndSpeak(closingPrompt)

    // Signal round complete
    this.config.sessionState.completed = true
  }

  // ─── Topic Coverage ───────────────────────────────────────

  private async checkTopicCoverage(candidateText: string): Promise<void> {
    const remaining = this.config.sessionState.mustCoverRemaining
    if (remaining.length === 0) return

    // Check each remaining must-cover topic
    for (const topic of [...remaining]) {
      try {
        let result = ''
        for await (const token of this.config.llmRouter.complete(
          [
            {
              role: 'user',
              content: `Did the candidate's answer address the topic "${topic}"? The answer was: "${candidateText.slice(0, 300)}". Answer ONLY "yes" or "no".`,
            },
          ],
          { maxTokens: 5, temperature: 0, preferFastModel: true, timeoutMs: 1500 },
        )) {
          result += token
        }

        if (result.trim().toLowerCase().startsWith('yes')) {
          // Topic covered
          const idx = this.config.sessionState.mustCoverRemaining.indexOf(topic)
          if (idx >= 0) this.config.sessionState.mustCoverRemaining.splice(idx, 1)
          this.config.sessionState.topicsCovered.push(topic)

          // Notify client
          this.sendToClient({
            type: 'topic:covered',
            payload: { topic, remainingMustCover: this.config.sessionState.mustCoverRemaining },
          })

          // Persist
          await this.config.redis.hset(
            `session:${this.config.sessionId}`,
            'topicsCovered',
            JSON.stringify(this.config.sessionState.topicsCovered),
            'mustCoverRemaining',
            JSON.stringify(this.config.sessionState.mustCoverRemaining),
          )
        }
      } catch {
        // Non-critical — skip topic check on failure
      }
    }
  }

  // ─── Redis Stream Listener ────────────────────────────────

  private async listenToStream(): Promise<void> {
    const streamKey = `interview:${this.config.sessionId}:events`
    const group = 'agents'
    const consumer = 'conversation'

    // Ensure consumer exists
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

            if (type === 'transcript:final') {
              const parsed = JSON.parse(data)
              await this.onTranscriptFinal(parsed.text)
            } else if (type === 'utterance:end') {
              // Signal for processing — handled via transcript:final
            } else if (type === 'code:followup:trigger') {
              const parsed = JSON.parse(data)
              await this.onCodeFollowUpTrigger(parsed.trigger, parsed.context)
            } else if (type === 'candidate:language_switch') {
              const parsed = JSON.parse(data)
              // Add multilingual instruction to system prompt
              this.conversationHistory[0].content +=
                `\n\nThe candidate has switched to responding in ${parsed.language === 'hi' ? 'Hindi' : parsed.language}. ` +
                `Accept their answers in their chosen language. Continue asking questions in English. ` +
                `Evaluate the technical content regardless of language choice — do not penalize for language.`
            }

            // Acknowledge message
            await this.config.redis.xack(streamKey, group, id)
          }
        }
      } catch (err) {
        if (this.stopped) break
        console.error('[ConversationAgent] Stream read error:', (err as Error).message)
        await delay(1000)
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private getNextTopic(): string {
    const state = this.config.sessionState
    const config = this.config.roundConfig

    // Prioritize must-cover topics
    if (state.mustCoverRemaining.length > 0) {
      return state.mustCoverRemaining[0]
    }

    // Then preferred topics not yet covered
    const uncovered = config.preferredTopics.filter((t) => !state.topicsCovered.includes(t))
    if (uncovered.length > 0) {
      return uncovered[0]
    }

    // Fallback
    return 'a relevant technical topic'
  }

  private getLastCandidateText(): string {
    for (let i = this.config.sessionState.transcript.length - 1; i >= 0; i--) {
      if (this.config.sessionState.transcript[i].role === 'candidate') {
        return this.config.sessionState.transcript[i].text
      }
    }
    return ''
  }

  private getTrimmedHistory(): { role: 'system' | 'user' | 'assistant'; content: string }[] {
    if (this.conversationHistory.length <= MAX_CONVERSATION_HISTORY) {
      return [...this.conversationHistory]
    }
    // Keep system prompt + last N messages
    return [
      this.conversationHistory[0],
      ...this.conversationHistory.slice(-MAX_CONVERSATION_HISTORY + 1),
    ]
  }

  private getTransitionPhrase(topic?: string): string {
    const available = TRANSITION_PHRASES
      .map((p, i) => ({ phrase: p, index: i }))
      .filter((p) => !this.usedTransitions.has(p.index))

    if (available.length === 0) {
      this.usedTransitions.clear()
      return this.getTransitionPhrase(topic)
    }

    const pick = available[Math.floor(Math.random() * available.length)]
    this.usedTransitions.add(pick.index)
    return pick.phrase.replace('{topic}', topic || 'that')
  }

  private sendToClient(message: { type: string; payload: unknown }): void {
    if (this.config.ws.readyState !== 1) return
    this.config.ws.send(
      JSON.stringify({
        ...message,
        timestamp: Date.now(),
        sessionId: this.config.sessionId,
      }),
    )
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
