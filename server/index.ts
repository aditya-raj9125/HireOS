import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import type { WebSocket } from 'ws'
import { LLMRouter } from './services/LLMRouter'
import { TTSService } from './services/TTSService'
import { ConversationAgent } from './agents/ConversationAgent'

// Load env from project root
config({ path: resolve(__dirname, '..', '.env.local') })

// ─── Types ──────────────────────────────────────────────────

interface SessionState {
  sessionId: string
  candidateId: string
  jobId: string
  roundType: string
  roundNumber: number
  startedAt: number
  durationSeconds: number
  warningAtSeconds: number
  transcript: { role: string; text: string; timestamp: number; isFinal: boolean }[]
  questionIndex: number
  questionsAsked: string[]
  topicsCovered: string[]
  mustCoverRemaining: string[]
  proctorEvents: unknown[]
  codeSnapshots: unknown[]
  whiteboardSnapshots: unknown[]
  runningScore: number
  completed: boolean
}

interface ActiveSession {
  ws: WebSocket
  state: SessionState
  timerInterval?: ReturnType<typeof setInterval>
  agent?: ConversationAgent
}

// ─── Infrastructure ─────────────────────────────────────────

// Redis is optional — falls back to in-memory store for local dev
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
const redis = new Redis(redisUrl, {
  lazyConnect: true,
  enableOfflineQueue: false,
  retryStrategy: () => null, // disable reconnection so errors stay silent
})

redis.connect().catch(() => {
  console.warn('[redis] Not available — session persistence disabled (in-memory only)')
})

redis.on('error', () => {
  // suppress ioredis unhandled error spam
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// ─── LLM Router (Cloudflare Workers AI) ─────────────────────

const llmRouter = new LLMRouter({
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  cloudflareAIToken: process.env.CLOUDFLARE_AI_TOKEN!,
  cloudflareAIGatewayUrl: process.env.CLOUDFLARE_AI_GATEWAY_URL || undefined,
})

const activeSessions = new Map<string, ActiveSession>()

// ─── Server Setup ───────────────────────────────────────────

export async function createInterviewServer() {
  const fastify = Fastify({
    logger: { level: 'info' },
  })

  await fastify.register(websocket)

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }))

  // WebSocket endpoint
  fastify.register(async function (fastify) {
    fastify.get('/ws/interview/:sessionId', { websocket: true }, (socket, req) => {
      const params = req.params as { sessionId: string }
      const sessionId = params.sessionId

      fastify.log.info(`WebSocket connection for session: ${sessionId}`)

      let validated = false
      let currentSession: ActiveSession | null = null

      socket.on('message', async (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString())

          // First message must be session:join
          if (!validated) {
            if (msg.type !== 'session:join') {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'INVALID_FIRST_MESSAGE',
                    message: 'First message must be session:join',
                    recoverable: false,
                    suggestedAction: 'Reload the page and try again',
                  },
                  timestamp: Date.now(),
                  sessionId,
                }),
              )
              socket.close()
              return
            }

            // Validate token
            const { token, candidateId, roundNumber, existingSessionId } = msg.payload
            const { data: invite, error } = await supabase
              .from('candidate_invites')
              .select('*, candidates(*), jobs(*)')
              .eq('token', token)
              .single()

            if (error || !invite) {
              fastify.log.error({ error, token }, 'Token validation failed')
              socket.send(
                JSON.stringify({
                  type: 'error',
                  payload: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired session token',
                    recoverable: false,
                    suggestedAction: 'Contact the recruiter for a new link',
                  },
                  timestamp: Date.now(),
                  sessionId,
                }),
              )
              socket.close()
              return
            }

            validated = true

            // Initialize or restore session
            let state: SessionState
            let resumedFrom: number | null = null

            if (existingSessionId) {
              // Attempt restoration from Redis
              let stored: Record<string, string> = {}
              try { stored = await redis.hgetall(`session:${existingSessionId}`) ?? {} } catch { /* no redis */ }
              if (stored && stored.sessionId) {
                state = {
                  sessionId: stored.sessionId,
                  candidateId: stored.candidateId,
                  jobId: stored.jobId,
                  roundType: stored.roundType,
                  roundNumber: parseInt(stored.roundNumber, 10),
                  startedAt: parseInt(stored.startedAt, 10),
                  durationSeconds: parseInt(stored.durationSeconds, 10),
                  warningAtSeconds: parseInt(stored.warningAtSeconds, 10),
                  transcript: JSON.parse(stored.transcript || '[]'),
                  questionIndex: parseInt(stored.questionIndex || '0', 10),
                  questionsAsked: JSON.parse(stored.questionsAsked || '[]'),
                  topicsCovered: JSON.parse(stored.topicsCovered || '[]'),
                  mustCoverRemaining: JSON.parse(stored.mustCoverRemaining || '[]'),
                  proctorEvents: JSON.parse(stored.proctorEvents || '[]'),
                  codeSnapshots: JSON.parse(stored.codeSnapshots || '[]'),
                  whiteboardSnapshots: JSON.parse(stored.whiteboardSnapshots || '[]'),
                  runningScore: parseFloat(stored.runningScore || '50'),
                  completed: stored.completed === 'true',
                }
                resumedFrom = state.startedAt
                fastify.log.info(`Session restored: ${existingSessionId}`)
              } else {
                state = createNewSession(sessionId, candidateId, invite.jobs, roundNumber)
              }
            } else {
              state = createNewSession(sessionId, candidateId, invite.jobs, roundNumber)
            }

            currentSession = { ws: socket, state, timerInterval: undefined }
            activeSessions.set(state.sessionId, currentSession)

            // Persist to Redis
            await persistSession(state)

            // Send confirmation
            socket.send(
              JSON.stringify({
                type: 'session:confirmed',
                payload: {
                  sessionId: state.sessionId,
                  agentReady: true,
                  resumedFrom,
                },
                timestamp: Date.now(),
                sessionId: state.sessionId,
              }),
            )

            // Start timer
            startTimer(currentSession)

            // Initialize agent pipeline
            await initializeAgents(currentSession, invite.candidates?.full_name, invite.jobs)

            return
          }

          // Handle validated messages
          if (!currentSession) return

          switch (msg.type) {
            case 'audio:chunk':
              // Forward to STT service via Redis stream
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'audio:chunk', 'data', JSON.stringify(msg.payload),
                )
              } catch { /* no redis */ }
              break

            case 'code:update':
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'code:update', 'data', JSON.stringify(msg.payload),
                )
              } catch { /* no redis */ }
              currentSession.state.codeSnapshots.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'code:run':
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'code:run', 'data', JSON.stringify(msg.payload),
                )
              } catch { /* no redis */ }
              break

            case 'whiteboard:update':
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'whiteboard:update', 'data', JSON.stringify(msg.payload),
                )
              } catch { /* no redis */ }
              currentSession.state.whiteboardSnapshots.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'proctor:event':
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'proctor:event', 'data', JSON.stringify(msg.payload),
                )
              } catch { /* no redis */ }
              currentSession.state.proctorEvents.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'candidate:ready':
              // System check done, ready to begin
              break

            case 'candidate:interrupt':
              try {
                await redis.xadd(
                  `interview:${currentSession.state.sessionId}:events`,
                  '*', 'type', 'candidate:interrupt', 'data', '{}',
                )
              } catch { /* no redis */ }
              break

            case 'candidate:finished':
              await handleRoundComplete(currentSession, msg.payload.reason)
              break

            case 'ping':
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
              break
          }

          // Persist state periodically
          await persistSession(currentSession.state)
        } catch (err) {
          fastify.log.error(err, 'Error processing WebSocket message')
        }
      })

      socket.on('close', () => {
        fastify.log.info(`WebSocket closed for session: ${sessionId}`)
        if (currentSession) {
          clearInterval(currentSession.timerInterval)
          currentSession.agent?.stop()
          // Don't delete — allow reconnection within 5 minutes
          redis.zadd(
            'session:expiry',
            Date.now() + 5 * 60 * 1000,
            currentSession.state.sessionId,
          ).catch(() => { /* no redis */ })
        }
      })

      socket.on('error', (err) => {
        fastify.log.error(err, 'WebSocket error')
      })
    })
  })

  return fastify
}

// ─── Helpers ────────────────────────────────────────────────

function createNewSession(
  sessionId: string,
  candidateId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job: { id: string; pipeline_v2?: any; pipeline_config?: any },
  roundNumber: number,
): SessionState {
  // Prefer pipeline_v2 rounds, fall back to pipeline_config rounds
  const v2Round = job.pipeline_v2?.rounds?.[roundNumber - 1]
  const v1Round = job.pipeline_config?.rounds?.[roundNumber - 1]
  const roundConfig = v2Round ?? v1Round
  const duration = (roundConfig?.durationMinutes ?? roundConfig?.config?.timeLimit ?? 30) * 60
  const warning = (roundConfig?.warningAtMinutes ?? 5) * 60

  return {
    sessionId,
    candidateId,
    jobId: job.id,
    roundType: (roundConfig?.type ?? roundConfig?.roundType ?? 'telephonic_screen') as SessionState['roundType'],
    roundNumber,
    startedAt: Date.now(),
    durationSeconds: duration,
    warningAtSeconds: warning,
    transcript: [],
    questionIndex: 0,
    questionsAsked: [],
    topicsCovered: [],
    mustCoverRemaining: roundConfig?.mustCoverTopics ?? [],
    proctorEvents: [],
    codeSnapshots: [],
    whiteboardSnapshots: [],
    runningScore: 50,
    completed: false,
  }
}

async function persistSession(state: SessionState) {
  const key = `session:${state.sessionId}`
  const data: Record<string, string> = {
    sessionId: state.sessionId,
    candidateId: state.candidateId,
    jobId: state.jobId,
    roundType: state.roundType,
    roundNumber: String(state.roundNumber),
    startedAt: String(state.startedAt),
    durationSeconds: String(state.durationSeconds),
    warningAtSeconds: String(state.warningAtSeconds),
    transcript: JSON.stringify(state.transcript),
    questionIndex: String(state.questionIndex),
    questionsAsked: JSON.stringify(state.questionsAsked),
    topicsCovered: JSON.stringify(state.topicsCovered),
    mustCoverRemaining: JSON.stringify(state.mustCoverRemaining),
    proctorEvents: JSON.stringify(state.proctorEvents),
    codeSnapshots: JSON.stringify(state.codeSnapshots),
    whiteboardSnapshots: JSON.stringify(state.whiteboardSnapshots),
    runningScore: String(state.runningScore),
    completed: String(state.completed),
  }

  try {
    const pipeline = redis.pipeline()
    pipeline.hmset(key, data)
    pipeline.expire(key, 4 * 60 * 60) // 4 hours TTL
    await pipeline.exec()
  } catch {
    // Redis unavailable — session stored in-memory only
  }
}

function startTimer(session: ActiveSession) {
  session.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - session.state.startedAt) / 1000
    const remaining = session.state.durationSeconds - elapsed
    const warningThreshold = session.state.warningAtSeconds

    let phase: 'normal' | 'warning' | 'overtime' = 'normal'
    if (remaining <= 0) {
      phase = 'overtime'
    } else if (remaining <= warningThreshold) {
      phase = 'warning'
    }

    const timerUpdate = {
      type: 'timer:update' as const,
      payload: {
        remainingSeconds: Math.max(0, Math.floor(remaining)),
        totalSeconds: session.state.durationSeconds,
        phase,
      },
      timestamp: Date.now(),
      sessionId: session.state.sessionId,
    }

    if (session.ws.readyState === 1) {
      session.ws.send(JSON.stringify(timerUpdate))
    }

    // Force complete after 30s overtime
    if (remaining <= -30) {
      handleRoundComplete(session, 'timeout')
    }
  }, 10000)
}

function getDefaultTopics(roundType: string): string[] {
  const defaults: Record<string, string[]> = {
    system_design: ['scalability', 'databases', 'API design'],
    live_coding: ['data structures', 'algorithms', 'problem solving'],
    behavioral: ['leadership', 'conflict resolution', 'ownership'],
    telephonic_screen: ['fundamentals', 'experience overview'],
    technical_deep_dive: ['architecture', 'trade-offs', 'debugging'],
    online_assessment: ['algorithms', 'data structures'],
  }
  return defaults[roundType] ?? ['technical skills']
}

function buildInterviewSystemPrompt(
  roundType: string,
  jobTitle: string,
  seniority: string,
  cfg: {
    durationMinutes: number
    preferredQuestionCount: number
    preferredTopics: string[]
    mustCoverTopics: string[]
    questionDifficulty: string
    warningAtMinutes: number
  },
): string {
  return [
    `You are a senior technical interviewer conducting a ${cfg.durationMinutes}-minute`,
    `${roundType.replace(/_/g, ' ')} interview for a ${seniority} ${jobTitle} position.`,
    `Topics to cover: ${cfg.preferredTopics.join(', ')}.`,
    `Must-cover topics: ${cfg.mustCoverTopics.join(', ') || 'none specified'}.`,
    `Target ${cfg.preferredQuestionCount} questions. Difficulty: ${cfg.questionDifficulty}.`,
    `Ask one question at a time. Never confirm if answers are correct or incorrect.`,
    `Be professional, encouraging, and thorough.`,
    `Warn the candidate when ${cfg.warningAtMinutes} minutes remain.`,
  ].join(' ')
}

async function initializeAgents(
  session: ActiveSession,
  candidateName?: string,
  job?: { id?: string; pipeline_v2?: unknown; pipeline_config?: unknown; title?: string; seniority?: string } | null,
) {
  // Create consumer group for the Redis stream
  const streamKey = `interview:${session.state.sessionId}:events`
  try {
    await redis.xgroup('CREATE', streamKey, 'agents', '0', 'MKSTREAM')
  } catch {
    // Redis unavailable or group already exists
  }

  // Build RoundConfig from pipeline data + fallback defaults
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v2Round = (job?.pipeline_v2 as any)?.rounds?.[session.state.roundNumber - 1]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v1Round = (job?.pipeline_config as any)?.rounds?.[session.state.roundNumber - 1]
  const pipelineRound = v2Round ?? v1Round
  const roundConfig = {
    durationMinutes: Math.round(session.state.durationSeconds / 60),
    warningAtMinutes: Math.round(session.state.warningAtSeconds / 60),
    preferredQuestionCount: pipelineRound?.preferredQuestionCount ?? 4,
    preferredTopics: pipelineRound?.preferredTopics ?? getDefaultTopics(session.state.roundType),
    mustCoverTopics: pipelineRound?.mustCoverTopics ?? [],
    questionDifficulty: (pipelineRound?.questionDifficulty ?? 'adaptive') as 'easy' | 'medium' | 'hard' | 'adaptive',
    customSystemPrompt: (pipelineRound?.systemPrompt ?? '') as string,
    followUpDepth: pipelineRound?.followUpDepth ?? 3,
    allowClarifyingQuestions: pipelineRound?.allowClarifyingQuestions ?? true,
  }

  // Build system prompt
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobTitle = (job as any)?.title ?? 'Software Engineer'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seniority = (job as any)?.seniority_level ?? (job as any)?.seniority ?? 'mid-level'
  const systemPrompt = roundConfig.customSystemPrompt || buildInterviewSystemPrompt(
    session.state.roundType, jobTitle, seniority, roundConfig,
  )

  // Create TTS service
  const ttsService = new TTSService({
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY!,
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID!,
  })

  // Create and start the ConversationAgent
  const agent = new ConversationAgent({
    sessionId: session.state.sessionId,
    ws: session.ws,
    redis,
    llmRouter,
    ttsService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionState: session.state as any,
    roundConfig,
    systemPrompt,
    candidateName,
    getDifficulty: () => roundConfig.questionDifficulty,
    getDifficultyInstruction: () => `Question difficulty: ${roundConfig.questionDifficulty}.`,
  })

  session.agent = agent

  // Send an immediate ai:question so the Problem Statement panel is never empty.
  // The agent will update it with LLM-generated content when ready.
  const firstTopic = roundConfig.preferredTopics[0] ?? 'system design'
  const immediateQuestion = {
    type: 'ai:question',
    payload: {
      questionText: `Welcome${candidateName ? `, ${candidateName}` : ''}! This is a ${session.state.roundType.replace(/_/g, ' ')} round (${roundConfig.durationMinutes} min). Let's start with ${firstTopic}.`,
      questionIndex: 1,
      topic: firstTopic,
      difficulty: roundConfig.questionDifficulty,
    },
    timestamp: Date.now(),
    sessionId: session.state.sessionId,
  }
  if (session.ws.readyState === 1) {
    session.ws.send(JSON.stringify(immediateQuestion))
    console.info(`[agents] Sent immediate ai:question for session ${session.state.sessionId}`)
  } else {
    console.warn(`[agents] WebSocket not open (readyState=${session.ws.readyState}), cannot send ai:question`)
  }

  agent.start().catch((err: Error) => {
    console.error(`[agents] ConversationAgent.start() error for ${session.state.sessionId}:`, err.message, err.stack)
  })

  console.info(`[agents] Session ${session.state.sessionId} agent started. roundType=${session.state.roundType}, candidateName=${candidateName ?? 'unknown'}`)
}

async function handleRoundComplete(session: ActiveSession, reason: string) {
  if (session.state.completed) return
  session.state.completed = true

  clearInterval(session.timerInterval)

  const elapsed = (Date.now() - session.state.startedAt) / 1000

  // Write round results to Supabase
  await supabase.from('round_results').upsert({
    session_id: session.state.sessionId,
    candidate_id: session.state.candidateId,
    job_id: session.state.jobId,
    round_type: session.state.roundType,
    round_number: session.state.roundNumber,
    status: 'completed',
    started_at: new Date(session.state.startedAt).toISOString(),
    duration_seconds: Math.floor(elapsed),
    transcript: session.state.transcript,
    proctor_log: session.state.proctorEvents,
    code_replay: session.state.codeSnapshots,
    whiteboard_snapshots: session.state.whiteboardSnapshots,
    adaptive_difficulty_log: [],
    score: session.state.runningScore,
  })

  // Send completion message
  if (session.ws.readyState === 1) {
    session.ws.send(
      JSON.stringify({
        type: 'round:complete',
        payload: {
          score: session.state.runningScore,
          recommendation: session.state.runningScore >= 70 ? 'advance' : session.state.runningScore >= 40 ? 'hold' : 'reject',
          summary: `Round completed. Duration: ${Math.floor(elapsed / 60)} minutes. Topics covered: ${session.state.topicsCovered.join(', ') || 'N/A'}.`,
        },
        timestamp: Date.now(),
        sessionId: session.state.sessionId,
      }),
    )
  }

  // Persist final state
  await persistSession(session.state)

  // Clean up Redis stream after 24 hours
  redis.expire(`interview:${session.state.sessionId}:events`, 24 * 60 * 60)

  activeSessions.delete(session.state.sessionId)
}

// ─── Start Server ───────────────────────────────────────────

async function main() {
  const server = await createInterviewServer()
  const port = parseInt(process.env.WS_PORT || '3001', 10)

  try {
    await server.listen({ port, host: '0.0.0.0' })
    console.log(`Interview WebSocket server running on port ${port}`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

main()
