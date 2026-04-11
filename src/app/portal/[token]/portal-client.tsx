'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Building2,
  Briefcase,
  Play,
} from 'lucide-react'
import { ROUND_TYPE_LABELS } from '@/lib/constants'
import type { CandidatePublic, JobPublic, InvitePublic, PipelineRound, RoundConfigV2 } from '@/types'
import SystemCheck from '@/components/portal/SystemCheck'
import { useInterviewSession } from '@/hooks/useInterviewSession'
import VoiceRound from '@/components/portal/rounds/VoiceRound'
import LiveCodingRound from '@/components/portal/rounds/LiveCodingRound'
import SystemDesignRound from '@/components/portal/rounds/SystemDesignRound'
import OARound from '@/components/portal/rounds/OARound'

interface PortalData {
  invite: InvitePublic
  candidate: CandidatePublic
  job: JobPublic
}

type Stage = 'landing' | 'system-check' | 'interview'

export function PortalClient({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const stageKey = `hireos_stage_${token}`
  const [stage, setStageState] = useState<Stage>(() => {
    if (typeof window !== 'undefined') {
      return (sessionStorage.getItem(stageKey) as Stage) || 'landing'
    }
    return 'landing'
  })

  const setStage = (s: Stage) => {
    sessionStorage.setItem(stageKey, s)
    setStageState(s)
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}`)
        if (!res.ok) {
          const body = await res.json()
          setError(body.error ?? 'Something went wrong')
          return
        }
        const { data } = await res.json()
        setData(data)
      } catch {
        setError('Failed to load assessment')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <InvalidInvite error={error} />
  }

  if (!data) return null

  const { invite, candidate, job } = data
  const rounds = job.pipeline.rounds

  if (stage === 'system-check') {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-10">
        <SystemCheck token={token} onComplete={() => setStage('interview')} />
      </div>
    )
  }

  if (stage === 'interview') {
    return (
      <InterviewStage
        token={token}
        candidate={candidate}
        rounds={rounds}
      />
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <span className="text-sm font-bold text-white">H</span>
            </div>
            <span className="text-sm font-medium text-neutral-500">
              Candidate Portal
            </span>
          </div>
          <Badge variant="teal" size="sm">
            <Clock className="mr-1 h-3 w-3" />
            {invite.status}
          </Badge>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {/* Welcome */}
        <div className="mb-8 space-y-2">
          <h1 className="text-2xl font-semibold text-neutral-900">
            Welcome, {candidate.full_name}
          </h1>
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              {job.company}
            </span>
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" />
              {job.title}
            </span>
          </div>
        </div>

        {/* Pipeline overview */}
        <Card padding="lg" className="mb-6">
          <h2 className="mb-4 text-base font-medium text-neutral-900">
            Assessment Pipeline
          </h2>
          <div className="space-y-3">
            {rounds.map((round: PipelineRound, idx: number) => {
              const label = ROUND_TYPE_LABELS[round.type]
              return (
                <div
                  key={round.id}
                  className="flex items-center gap-4 rounded-lg border border-neutral-200 px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-500">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800">
                      {round.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {label ?? round.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Circle className="h-4 w-4 text-neutral-300" />
                </div>
              )
            })}
          </div>
        </Card>

        {/* Start button */}
        <div className="text-center">
          <Button variant="primary" size="lg" className="px-8" onClick={() => setStage('system-check')}>
            <Play className="h-4 w-4" />
            Begin Assessment
          </Button>
          <p className="mt-3 text-xs text-neutral-400">
            Once started, the timer begins and cannot be paused.
          </p>
        </div>
      </main>
    </div>
  )
}

/* ─── Interview Stage ────────────────────────────────────── */

interface RoundSession {
  sessionId: string
  wsUrl: string
  roundConfig: RoundConfigV2
  roundNumber: number
}

function InterviewStage({
  token,
  candidate,
  rounds,
}: {
  token: string
  candidate: CandidatePublic
  rounds: PipelineRound[]
}) {
  const roundNumber = 1
  const currentRound = rounds[roundNumber - 1]
  const roundType = currentRound?.type

  const [roundSession, setRoundSession] = useState<RoundSession | null>(null)
  const [startError, setStartError] = useState<string | null>(null)

  // Call start-round API to get session ID and WS URL
  useEffect(() => {
    let cancelled = false
    async function startRound() {
      try {
        const res = await fetch(`/api/portal/${token}/start-round`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundNumber }),
        })
        if (!res.ok) {
          const body = await res.json()
          if (!cancelled) setStartError(body.error ?? 'Failed to start round')
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setRoundSession({
            sessionId: data.sessionId,
            wsUrl: data.wsUrl,
            roundConfig: data.roundConfig as RoundConfigV2,
            roundNumber: data.roundNumber,
          })
        }
      } catch {
        if (!cancelled) setStartError('Network error — please refresh and try again')
      }
    }
    startRound()
    return () => { cancelled = true }
  }, [token, roundNumber])

  if (startError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <Card padding="lg" className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">Could not start round</h2>
          <p className="text-sm text-neutral-500">{startError}</p>
        </Card>
      </div>
    )
  }

  if (!roundSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-neutral-500">Starting your assessment…</p>
        </div>
      </div>
    )
  }

  // OA rounds don't use WebSocket — render directly
  if (roundType === 'online_assessment') {
    return (
      <OARound
        token={token}
        timerState={null}
        roundConfig={roundSession.roundConfig}
      />
    )
  }

  // All other round types need a WebSocket session
  return (
    <WebSocketRound
      token={token}
      candidate={candidate}
      currentRound={currentRound}
      roundSession={roundSession}
    />
  )
}

/* ─── WebSocket-backed rounds ────────────────────────────── */

function WebSocketRound({
  token,
  candidate,
  currentRound,
  roundSession,
}: {
  token: string
  candidate: CandidatePublic
  currentRound: PipelineRound
  roundSession: RoundSession
}) {
  const session = useInterviewSession({
    wsUrl: roundSession.wsUrl,
    token,
    candidateId: candidate.id,
    roundNumber: roundSession.roundNumber,
  })

  const roundConfig = roundSession.roundConfig
  const roundType = currentRound.type

  if (session.connectionStatus === 'connecting') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-neutral-500">Connecting to interview server…</p>
        </div>
      </div>
    )
  }

  if (roundType === 'live_coding' || roundType === 'technical_deep_dive') {
    return (
      <LiveCodingRound
        sessionId={session.sessionId ?? roundSession.sessionId}
        sendMessage={session.sendMessage as Parameters<typeof LiveCodingRound>[0]['sendMessage']}
        currentQuestion={session.currentQuestion}
        codeResults={null}
        codeFollowUp={null}
        transcript={session.transcript}
        timerState={session.timerState}
        roundConfig={roundConfig}
      />
    )
  }

  if (roundType === 'system_design') {
    return (
      <SystemDesignRound
        sessionId={session.sessionId ?? roundSession.sessionId}
        sendMessage={session.sendMessage as Parameters<typeof SystemDesignRound>[0]['sendMessage']}
        currentQuestion={session.currentQuestion}
        transcript={session.transcript}
        timerState={session.timerState}
        topicsCovered={session.topicsCovered}
        mustCoverRemaining={session.mustCoverRemaining}
        roundConfig={roundConfig}
      />
    )
  }

  // Default: voice-based rounds (telephonic_screen, behavioral)
  return (
    <VoiceRound
      sessionId={session.sessionId ?? roundSession.sessionId}
      sendMessage={session.sendMessage as Parameters<typeof VoiceRound>[0]['sendMessage']}
      transcript={session.transcript}
      isAISpeaking={session.isAISpeaking}
      currentQuestion={session.currentQuestion}
      timerState={session.timerState}
      topicsCovered={session.topicsCovered}
      mustCoverRemaining={session.mustCoverRemaining}
      roundConfig={roundConfig}
      roundName={currentRound?.name ?? 'Interview'}
      roundType={roundType === 'behavioral' ? 'behavioral' : 'telephonic_screen'}
    />
  )
}

/* ─── Error State ────────────────────────────────────────── */

function InvalidInvite({ error }: { error: string }) {
  const isExpired = error.toLowerCase().includes('expired')

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <Card padding="lg" className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <h1 className="mb-2 text-lg font-semibold text-neutral-900">
          {isExpired ? 'Invite Expired' : 'Invalid Invite'}
        </h1>
        <p className="text-sm text-neutral-500">
          {isExpired
            ? 'This assessment link has expired. Please contact the hiring team for a new invitation.'
            : 'This invite link is invalid or has already been used. Please check the link or contact the hiring team.'}
        </p>
      </Card>
    </div>
  )
}
