'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientMessage,
  ServerMessage,
  TranscriptEntry,
  ProctorEvent,
  TimerUpdatePayload,
  AIQuestionPayload,
} from '@/types'
import {
  buildSessionJoin,
  buildCandidateFinished,
  parseMessage,
  serializeMessage,
  isServerMessage,
} from '@/lib/interviewProtocol'

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed'

interface UseInterviewSessionOptions {
  wsUrl: string
  token: string
  candidateId: string
  roundNumber: number
}

interface InterviewSessionState {
  sendMessage: (msg: ClientMessage) => void
  connectionStatus: ConnectionStatus
  sessionId: string | null
  reconnecting: boolean
  lastServerMessage: ServerMessage | null
  proctorEvents: ProctorEvent[]
  timerState: TimerUpdatePayload | null
  transcript: TranscriptEntry[]
  isAISpeaking: boolean
  currentQuestion: AIQuestionPayload | null
  topicsCovered: string[]
  mustCoverRemaining: string[]
  recoveryNotification: string | null
}

const MAX_BACKOFF_MS = 30000
const HEARTBEAT_INTERVAL_MS = 15000
const HEARTBEAT_TIMEOUT_MS = 30000
const SESSION_STORAGE_KEY = 'hireos_session_id'

export function useInterviewSession(options: UseInterviewSessionOptions): InterviewSessionState {
  const { wsUrl, token, candidateId, roundNumber } = options

  const wsRef = useRef<WebSocket | null>(null)
  const messageQueueRef = useRef<ClientMessage[]>([])
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval>>()
  const lastServerMessageTimeRef = useRef(Date.now())
  const mountedRef = useRef(true)

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lastServerMessage, setLastServerMessage] = useState<ServerMessage | null>(null)
  const [proctorEvents, setProctorEvents] = useState<ProctorEvent[]>([])
  const [timerState, setTimerState] = useState<TimerUpdatePayload | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestionPayload | null>(null)
  const [topicsCovered, setTopicsCovered] = useState<string[]>([])
  const [mustCoverRemaining, setMustCoverRemaining] = useState<string[]>([])
  const [recoveryNotification, setRecoveryNotification] = useState<string | null>(null)

  // Flush queued messages
  const flushQueue = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    while (messageQueueRef.current.length > 0) {
      const msg = messageQueueRef.current.shift()!
      ws.send(serializeMessage(msg))
    }
  }, [])

  // Send message (queues if not connected)
  const sendMessage = useCallback(
    (msg: ClientMessage) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(serializeMessage(msg))
      } else {
        messageQueueRef.current.push(msg)
      }
    },
    [],
  )

  // Handle incoming server messages
  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      lastServerMessageTimeRef.current = Date.now()
      setLastServerMessage(msg)

      switch (msg.type) {
        case 'session:confirmed': {
          const sid = msg.payload.sessionId
          setSessionId(sid)
          try {
            sessionStorage.setItem(SESSION_STORAGE_KEY, sid)
          } catch {}
          if (msg.payload.resumedFrom) {
            const resumeDate = new Date(msg.payload.resumedFrom).toLocaleTimeString()
            setRecoveryNotification(`Session resumed from ${resumeDate}`)
            setTimeout(() => setRecoveryNotification(null), 5000)
          }
          break
        }

        case 'ai:text': {
          if (msg.payload.isFinal) {
            setTranscript((prev) => [
              ...prev,
              {
                role: 'ai',
                text: msg.payload.text,
                timestamp: msg.timestamp,
                isFinal: true,
              },
            ])
          }
          break
        }

        case 'ai:audio': {
          setIsAISpeaking(!msg.payload.isLastChunk)
          break
        }

        case 'ai:question': {
          setCurrentQuestion(msg.payload)
          break
        }

        case 'timer:update': {
          setTimerState(msg.payload)
          break
        }

        case 'topic:covered': {
          setTopicsCovered((prev) =>
            prev.includes(msg.payload.topic) ? prev : [...prev, msg.payload.topic],
          )
          setMustCoverRemaining(msg.payload.remainingMustCover)
          break
        }

        case 'proctor:acknowledged': {
          // Acknowledged — no client action needed
          break
        }

        case 'round:complete': {
          // Parent component handles navigation
          break
        }

        case 'error': {
          if (!msg.payload.recoverable) {
            setConnectionStatus('failed')
          }
          break
        }

        case 'connection:quality': {
          // Handled by AdaptiveQualityManager externally
          break
        }
      }
    },
    [],
  )

  // Connect/reconnect to WebSocket
  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const existingSessionId =
      sessionId ??
      (() => {
        try {
          return sessionStorage.getItem(SESSION_STORAGE_KEY)
        } catch {
          return null
        }
      })()

    setConnectionStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting')

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close()
        return
      }
      setConnectionStatus('connected')
      reconnectAttemptRef.current = 0

      // Send join message
      const joinMsg = buildSessionJoin(existingSessionId ?? '', {
        token,
        candidateId,
        roundNumber,
        existingSessionId: existingSessionId ?? undefined,
      })
      ws.send(serializeMessage(joinMsg))

      // Flush queued messages
      flushQueue()
    }

    ws.onmessage = (event) => {
      const msg = parseMessage(typeof event.data === 'string' ? event.data : '')
      if (msg && isServerMessage(msg)) {
        handleMessage(msg as ServerMessage)
      }
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after onerror
    }
  }, [wsUrl, token, candidateId, roundNumber, sessionId, flushQueue, handleMessage])

  // Exponential backoff reconnect
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return

    const attempt = reconnectAttemptRef.current
    const delay = Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS)
    reconnectAttemptRef.current = attempt + 1

    if (attempt >= 10) {
      setConnectionStatus('failed')
      return
    }

    setConnectionStatus('reconnecting')
    reconnectTimerRef.current = setTimeout(connect, delay)
  }, [connect])

  // Heartbeat
  useEffect(() => {
    heartbeatTimerRef.current = setInterval(() => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      }

      // Check for server silence
      if (Date.now() - lastServerMessageTimeRef.current > HEARTBEAT_TIMEOUT_MS) {
        const ws = wsRef.current
        if (ws) {
          ws.close()
        }
      }
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      clearInterval(heartbeatTimerRef.current)
    }
  }, [])

  // Initial connect
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimerRef.current)

      // Send finished before closing
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        const sid = sessionId ?? ''
        ws.send(serializeMessage(buildCandidateFinished(sid, 'submitted')))
        ws.close(1000, 'Session ended')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    sendMessage,
    connectionStatus,
    sessionId,
    reconnecting: connectionStatus === 'reconnecting',
    lastServerMessage,
    proctorEvents,
    timerState,
    transcript,
    isAISpeaking,
    currentQuestion,
    topicsCovered,
    mustCoverRemaining,
    recoveryNotification,
  }
}
