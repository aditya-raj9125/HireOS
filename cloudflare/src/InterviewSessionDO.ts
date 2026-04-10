// ============================================================
// HireOS — Interview Session Durable Object
// Manages session state, WebSocket connections, and alarms
// for auto-completion of abandoned sessions.
// ============================================================

export interface Env {
  AI: Ai
  R2: R2Bucket
  ALLOWED_ORIGIN: string
}

interface SessionState {
  sessionId: string
  candidateId: string
  jobId: string
  roundType: string
  roundNumber: number
  startedAt: number
  durationSeconds: number
  transcript: { role: string; text: string; timestamp: number; isFinal: boolean }[]
  questionIndex: number
  topicsCovered: string[]
  mustCoverRemaining: string[]
  runningScore: number
  completed: boolean
}

export class InterviewSessionDO implements DurableObject {
  private state: DurableObjectState
  private env: Env
  private sessions: WebSocket[] = []
  private sessionData: SessionState | null = null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/connect') {
      return this.handleWebSocket(request)
    }

    if (url.pathname === '/restore') {
      return this.handleRestore()
    }

    if (url.pathname === '/init' && request.method === 'POST') {
      return this.handleInit(request)
    }

    return new Response('Not found', { status: 404 })
  }

  // ─── WebSocket Connection ─────────────────────────────────

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.state.acceptWebSocket(server)
    this.sessions.push(server)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return

    try {
      const msg = JSON.parse(message)

      // Store meaningful state changes
      if (msg.type === 'transcript:update' && this.sessionData) {
        this.sessionData.transcript = msg.payload.transcript
        await this.persistState()
      }

      if (msg.type === 'topic:covered' && this.sessionData) {
        this.sessionData.topicsCovered = msg.payload.topicsCovered
        this.sessionData.mustCoverRemaining = msg.payload.mustCoverRemaining
        await this.persistState()
      }

      if (msg.type === 'score:update' && this.sessionData) {
        this.sessionData.runningScore = msg.payload.score
        await this.persistState()
      }

      if (msg.type === 'round:complete' && this.sessionData) {
        this.sessionData.completed = true
        await this.persistState()
        // Clear any pending alarm
        await this.state.storage.deleteAlarm()
      }

      // Broadcast to all connected WebSockets
      for (const session of this.sessions) {
        try {
          session.send(message)
        } catch {
          // Socket may be closed
        }
      }
    } catch (err) {
      console.error('Error processing DO message:', err)
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.sessions = this.sessions.filter((s) => s !== ws)

    // If no more connections, set alarm for 5 minutes
    if (this.sessions.length === 0 && this.sessionData && !this.sessionData.completed) {
      const alarmTime = Date.now() + 5 * 60 * 1000
      await this.state.storage.setAlarm(alarmTime)
    }
  }

  async alarm(): Promise<void> {
    // If session is still incomplete and no connections, auto-complete
    if (this.sessionData && !this.sessionData.completed && this.sessions.length === 0) {
      this.sessionData.completed = true
      await this.persistState()

      // Notify the Next.js API to finalize the session
      try {
        await fetch(`${this.env.ALLOWED_ORIGIN}/api/internal/session-timeout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: this.sessionData.sessionId,
            candidateId: this.sessionData.candidateId,
            jobId: this.sessionData.jobId,
            reason: 'abandoned',
          }),
        })
      } catch (err) {
        console.error('Failed to notify session timeout:', err)
      }
    }
  }

  // ─── Initialization ───────────────────────────────────────

  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json()) as Partial<SessionState>

    this.sessionData = {
      sessionId: body.sessionId || '',
      candidateId: body.candidateId || '',
      jobId: body.jobId || '',
      roundType: body.roundType || '',
      roundNumber: body.roundNumber || 1,
      startedAt: Date.now(),
      durationSeconds: body.durationSeconds || 1800,
      transcript: [],
      questionIndex: 0,
      topicsCovered: [],
      mustCoverRemaining: body.mustCoverRemaining || [],
      runningScore: 50,
      completed: false,
    }

    await this.persistState()

    return new Response(JSON.stringify({ ok: true, sessionId: this.sessionData.sessionId }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── State Restore ────────────────────────────────────────

  private async handleRestore(): Promise<Response> {
    const stored = await this.state.storage.get<SessionState>('session')
    if (!stored) {
      return new Response(JSON.stringify({ ok: false, error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, session: stored }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ─── Persistence ──────────────────────────────────────────

  private async persistState(): Promise<void> {
    if (this.sessionData) {
      await this.state.storage.put('session', this.sessionData)
    }
  }
}
