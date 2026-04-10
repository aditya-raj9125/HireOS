// ============================================================
// HireOS — Interview WebSocket Protocol
// Message builders and helpers for the typed WebSocket protocol
// ============================================================

import type {
  ClientMessage,
  ServerMessage,
  SessionJoinPayload,
  AudioChunkPayload,
  CodeUpdatePayload,
  CodeRunPayload,
  WhiteboardUpdatePayload,
  ProctorEventPayload,
  CandidateFinishedPayload,
  SessionConfirmedPayload,
  AITextPayload,
  AIAudioPayload,
  AIQuestionPayload,
  CodeFollowUpPayload,
  CodeResultPayload,
  TopicCoveredPayload,
  TimerUpdatePayload,
  ProctorAcknowledgedPayload,
  RoundCompletePayload,
  WSErrorPayload,
  ConnectionQualityPayload,
  CodeFollowUpTrigger,
  ProctorEventType,
} from '@/types'

// ─── Client → Server Message Builders ───────────────────────

export function buildSessionJoin(
  sessionId: string,
  payload: SessionJoinPayload,
): ClientMessage {
  return {
    type: 'session:join',
    payload,
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildAudioChunk(
  sessionId: string,
  data: string,
  sampleRate: number,
  sequenceNumber: number,
): ClientMessage {
  return {
    type: 'audio:chunk',
    payload: { data, sampleRate, sequenceNumber },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCodeUpdate(
  sessionId: string,
  content: string,
  language: string,
  cursorLine: number,
  cursorColumn: number,
  snapshotIndex: number,
): ClientMessage {
  return {
    type: 'code:update',
    payload: { content, language, cursorLine, cursorColumn, snapshotIndex },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCodeRun(
  sessionId: string,
  code: string,
  language: string,
  testCases: CodeRunPayload['testCases'],
): ClientMessage {
  return {
    type: 'code:run',
    payload: { code, language, testCases },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildWhiteboardUpdate(
  sessionId: string,
  elements: Record<string, unknown>[],
  appStatePartial: Record<string, unknown>,
): ClientMessage {
  return {
    type: 'whiteboard:update',
    payload: { elements, appStatePartial },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildProctorEvent(
  sessionId: string,
  eventType: ProctorEventType,
  detail: string,
  severity: 'low' | 'medium' | 'high',
  frameTimestamp: number,
): ClientMessage {
  return {
    type: 'proctor:event',
    payload: { eventType, detail, severity, frameTimestamp },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCandidateReady(sessionId: string): ClientMessage {
  return {
    type: 'candidate:ready',
    payload: {},
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCandidateInterrupt(sessionId: string): ClientMessage {
  return {
    type: 'candidate:interrupt',
    payload: {},
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCandidateFinished(
  sessionId: string,
  reason: CandidateFinishedPayload['reason'],
): ClientMessage {
  return {
    type: 'candidate:finished',
    payload: { reason },
    timestamp: Date.now(),
    sessionId,
  }
}

// ─── Server → Client Message Builders ───────────────────────

export function buildSessionConfirmed(
  sessionId: string,
  agentReady: boolean,
  resumedFrom: number | null,
): ServerMessage {
  return {
    type: 'session:confirmed',
    payload: { sessionId, agentReady, resumedFrom },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildAIText(
  sessionId: string,
  text: string,
  isFinal: boolean,
  questionIndex: number,
  topic: string,
): ServerMessage {
  return {
    type: 'ai:text',
    payload: { text, isFinal, questionIndex, topic },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildAIAudio(
  sessionId: string,
  data: string,
  sampleRate: number,
  sequenceNumber: number,
  isLastChunk: boolean,
): ServerMessage {
  return {
    type: 'ai:audio',
    payload: { data, sampleRate, sequenceNumber, isLastChunk },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildAIQuestion(
  sessionId: string,
  payload: AIQuestionPayload,
): ServerMessage {
  return {
    type: 'ai:question',
    payload,
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCodeFollowUp(
  sessionId: string,
  questionText: string,
  triggeredBy: CodeFollowUpTrigger,
  problemId: string,
): ServerMessage {
  return {
    type: 'code:followup',
    payload: { questionText, triggeredBy, problemId },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildCodeResult(
  sessionId: string,
  payload: CodeResultPayload,
): ServerMessage {
  return {
    type: 'code:result',
    payload,
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildTopicCovered(
  sessionId: string,
  topic: string,
  remainingMustCover: string[],
): ServerMessage {
  return {
    type: 'topic:covered',
    payload: { topic, remainingMustCover },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildTimerUpdate(
  sessionId: string,
  remainingSeconds: number,
  totalSeconds: number,
  phase: TimerUpdatePayload['phase'],
): ServerMessage {
  return {
    type: 'timer:update',
    payload: { remainingSeconds, totalSeconds, phase },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildProctorAcknowledged(
  sessionId: string,
  eventId: string,
  severity: ProctorAcknowledgedPayload['severity'],
): ServerMessage {
  return {
    type: 'proctor:acknowledged',
    payload: { eventId, severity },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildRoundComplete(
  sessionId: string,
  score: number,
  recommendation: RoundCompletePayload['recommendation'],
  summary: string,
): ServerMessage {
  return {
    type: 'round:complete',
    payload: { score, recommendation, summary },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildWSError(
  sessionId: string,
  code: string,
  message: string,
  recoverable: boolean,
  suggestedAction: string,
): ServerMessage {
  return {
    type: 'error',
    payload: { code, message, recoverable, suggestedAction },
    timestamp: Date.now(),
    sessionId,
  }
}

export function buildConnectionQuality(
  sessionId: string,
  latencyMs: number,
  quality: ConnectionQualityPayload['quality'],
): ServerMessage {
  return {
    type: 'connection:quality',
    payload: { latencyMs, quality },
    timestamp: Date.now(),
    sessionId,
  }
}

// ─── Helpers ────────────────────────────────────────────────

/** Parse a raw WebSocket string into a typed message. Returns null on invalid JSON. */
export function parseMessage(raw: string): ClientMessage | ServerMessage | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.type !== 'string' || typeof parsed.timestamp !== 'number') {
      return null
    }
    return parsed as ClientMessage | ServerMessage
  } catch {
    return null
  }
}

/** Serialize a message for WebSocket transport */
export function serializeMessage(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg)
}

/** Type guard: is this a client message? */
export function isClientMessage(
  msg: ClientMessage | ServerMessage,
): msg is ClientMessage {
  const clientTypes = [
    'session:join',
    'audio:chunk',
    'code:update',
    'code:run',
    'whiteboard:update',
    'proctor:event',
    'candidate:ready',
    'candidate:interrupt',
    'candidate:finished',
  ]
  return clientTypes.includes(msg.type)
}

/** Type guard: is this a server message? */
export function isServerMessage(
  msg: ClientMessage | ServerMessage,
): msg is ServerMessage {
  return !isClientMessage(msg)
}

/** Extract the message type from a raw string without full parsing */
export function peekMessageType(raw: string): string | null {
  const match = raw.match(/"type"\s*:\s*"([^"]+)"/)
  return match ? match[1] : null
}
