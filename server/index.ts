import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import Redis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'
import type { WebSocket } from 'ws'

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
}

// ─── Infrastructure ─────────────────────────────────────────

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

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
              .from('invites')
              .select('*, candidates(*), jobs(*)')
              .eq('token', token)
              .single()

            if (error || !invite) {
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
              const stored = await redis.hgetall(`session:${existingSessionId}`)
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
            await initializeAgents(state)

            return
          }

          // Handle validated messages
          if (!currentSession) return

          switch (msg.type) {
            case 'audio:chunk':
              // Forward to STT service via Redis stream
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'audio:chunk',
                'data',
                JSON.stringify(msg.payload),
              )
              break

            case 'code:update':
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'code:update',
                'data',
                JSON.stringify(msg.payload),
              )
              currentSession.state.codeSnapshots.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'code:run':
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'code:run',
                'data',
                JSON.stringify(msg.payload),
              )
              break

            case 'whiteboard:update':
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'whiteboard:update',
                'data',
                JSON.stringify(msg.payload),
              )
              currentSession.state.whiteboardSnapshots.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'proctor:event':
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'proctor:event',
                'data',
                JSON.stringify(msg.payload),
              )
              currentSession.state.proctorEvents.push({
                ...msg.payload,
                timestamp: Date.now(),
              })
              break

            case 'candidate:ready':
              // System check done, ready to begin
              break

            case 'candidate:interrupt':
              await redis.xadd(
                `interview:${currentSession.state.sessionId}:events`,
                '*',
                'type',
                'candidate:interrupt',
                'data',
                '{}',
              )
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
          // Don't delete — allow reconnection within 5 minutes
          redis.zadd(
            'session:expiry',
            Date.now() + 5 * 60 * 1000,
            currentSession.state.sessionId,
          )
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
  job: { id: string; pipeline_v2?: { rounds?: { durationMinutes?: number; warningAtMinutes?: number; type?: string; mustCoverTopics?: string[] }[] } },
  roundNumber: number,
): SessionState {
  const roundConfig = job.pipeline_v2?.rounds?.[roundNumber - 1]
  const duration = (roundConfig?.durationMinutes ?? 30) * 60
  const warning = (roundConfig?.warningAtMinutes ?? 5) * 60

  return {
    sessionId,
    candidateId,
    jobId: job.id,
    roundType: roundConfig?.type ?? 'telephonic_screen',
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

  const pipeline = redis.pipeline()
  pipeline.hmset(key, data)
  pipeline.expire(key, 4 * 60 * 60) // 4 hours TTL
  await pipeline.exec()
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

async function initializeAgents(state: SessionState) {
  // Create consumer group for the Redis stream
  const streamKey = `interview:${state.sessionId}:events`
  try {
    await redis.xgroup('CREATE', streamKey, 'agents', '0', 'MKSTREAM')
  } catch {
    // Group may already exist on reconnection
  }

  // Agents are initialized lazily and subscribe to the stream
  // ConversationAgent, CodeWatcherAgent, EvaluationAgent, ProctorAgent
  // Each runs as an async listener on the Redis stream consumer group
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
