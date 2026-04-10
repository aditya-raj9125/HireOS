// ============================================================
// HireOS — TypeScript Type Definitions
// All database row types, JSONB types, enums, API types
// ============================================================

// ─── Enums (string union types matching Supabase enums) ─────

export type JobStatus = 'draft' | 'active' | 'paused' | 'closed'

export type CandidateStatus =
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'hired'
  | 'on_hold'

export type RoundType =
  | 'online_assessment'
  | 'telephonic_screen'
  | 'live_coding'
  | 'system_design'
  | 'behavioral'
  | 'technical_deep_dive'

export type InviteStatus = 'pending' | 'opened' | 'started' | 'expired'

// ─── JSONB Field Types ──────────────────────────────────────

export interface PipelineRound {
  id: string
  type: RoundType
  name: string
  order: number
  config: RoundConfig
}

export interface RoundConfig {
  timeLimit?: number
  questionCount?: number
  skills?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  customPrompt?: string
}

export interface PipelineConfig {
  rounds: PipelineRound[]
}

export interface SkillWeight {
  skill: string
  weight: number
  subParams: SubParam[]
}

export interface SubParam {
  name: string
  weight: number
}

export interface ScoringRubric {
  skills: SkillWeight[]
}

export interface AutoAdvanceRules {
  advanceThreshold: number
  rejectThreshold: number
  mustPassSkills: string[]
}

export interface ParsedResume {
  skills: string[]
  yearsOfExperience: number
  lastRole: string
  education: string
}

export interface SkillScores {
  [skill: string]: {
    score: number
    justification: string
  }
}

// ─── Database Row Types ─────────────────────────────────────

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  website: string | null
  industry: string | null
  size: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  organization_id: string | null
  full_name: string | null
  email: string
  role: 'hr' | 'admin' | 'hiring_manager'
  avatar_url: string | null
  created_at: string
}

export interface Job {
  id: string
  organization_id: string
  created_by: string
  title: string
  department: string | null
  location: string | null
  job_type: string
  seniority_level: string | null
  description: string | null
  required_skills: string[]
  nice_to_have_skills: string[]
  status: JobStatus
  target_headcount: number
  deadline: string | null
  pipeline_config: PipelineConfig
  scoring_rubric: ScoringRubric
  auto_advance_rules: AutoAdvanceRules
  created_at: string
  updated_at: string
}

export interface Candidate {
  id: string
  organization_id: string
  job_id: string
  full_name: string
  email: string
  phone: string | null
  resume_url: string | null
  parsed_resume: ParsedResume
  source: string
  status: CandidateStatus
  current_round: number
  overall_score: number | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CandidateInvite {
  id: string
  candidate_id: string
  job_id: string
  token: string
  status: InviteStatus
  expires_at: string
  opened_at: string | null
  started_at: string | null
  created_at: string
}

export interface RoundResult {
  id: string
  candidate_id: string
  job_id: string
  round_type: RoundType
  round_number: number
  score: number | null
  max_score: number
  recommendation: 'advance' | 'hold' | 'reject' | null
  skill_scores: SkillScores
  ai_summary: string | null
  integrity_score: number | null
  flag_count: number
  completed_at: string | null
  created_at: string
}

// ─── API Response Types ─────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// ─── Dashboard Computed Types ───────────────────────────────

/** Job with aggregated candidate stats for listing views */
export interface JobWithStats extends Job {
  candidateCount: number
  avgScore: number
  completionRate: number
}

/** Candidate with their round results and invite info */
export interface CandidateWithRounds extends Candidate {
  rounds: RoundResult[]
  invite: CandidateInvite | null
}

// ─── Public Portal Types (limited data exposure) ────────────

export interface CandidatePublic {
  id: string
  full_name: string
  email: string
}

export interface JobPublic {
  title: string
  department: string | null
  company: string
  pipeline: PipelineConfig
}

export interface InvitePublic {
  status: InviteStatus
  expires_at: string
}

// ─── Form Types ─────────────────────────────────────────────

export interface CreateJobForm {
  title: string
  department?: string
  location?: string
  job_type: string
  seniority_level?: string
  description?: string
  required_skills: string[]
  nice_to_have_skills: string[]
  target_headcount: number
  deadline?: string
  pipeline_config: PipelineConfig
  scoring_rubric: ScoringRubric
  auto_advance_rules: AutoAdvanceRules
}

export interface UpdateJobForm extends Partial<CreateJobForm> {
  status?: JobStatus
}

export interface CreateCandidateForm {
  full_name: string
  email: string
  phone?: string
  source?: string
}

export interface InviteForm {
  candidate_id: string
  job_id: string
}

// ─── Dashboard Stats Types ──────────────────────────────────

export interface DashboardStats {
  activeJobs: number
  totalCandidates: number
  avgCompletionRate: number
  avgTimeToHire: number
}

export interface FunnelStage {
  stage: string
  count: number
}

export interface SourceBreakdown {
  source: string
  count: number
}

export interface ScoreDistributionBucket {
  range: string
  count: number
}

// ============================================================
// PART 2 — Interview Engine Types
// ============================================================

// ─── Pipeline V2 Types ──────────────────────────────────────

export interface PipelineRoundV2 extends PipelineRound {
  durationMinutes: number
  warningAtMinutes: number
  preferredQuestionCount: number
  preferredTopics: string[]
  mustCoverTopics: string[]
  questionDifficulty: 'easy' | 'medium' | 'hard' | 'adaptive'
  config: RoundConfigV2
}

export interface RoundConfigV2 extends RoundConfig {
  evaluationFocus: string[]
  customSystemPrompt: string
  allowClarifyingQuestions: boolean
  followUpDepth: 1 | 2 | 3 | 4 | 5
  showHintsIfStuck: boolean
  allowedLanguages: string[]
  topicArea: string
  scaffoldProvided: boolean
}

export interface PipelineConfigV2 {
  rounds: PipelineRoundV2[]
  bufferDaysBetweenRounds: number
  expiresAt: string | null
}

// ─── Session and Transcript Types ───────────────────────────

export interface SessionState {
  sessionId: string
  candidateId: string
  jobId: string
  roundType: RoundType
  roundNumber: number
  startedAt: number
  durationSeconds: number
  warningAtSeconds: number
  transcript: TranscriptEntry[]
  questionIndex: number
  questionsAsked: string[]
  topicsCovered: string[]
  mustCoverRemaining: string[]
  proctorEvents: ProctorEvent[]
  codeSnapshots: CodeSnapshot[]
  whiteboardSnapshots: WhiteboardSnapshot[]
  runningScore: number
  completed: boolean
}

export interface TranscriptEntry {
  role: 'ai' | 'candidate'
  text: string
  timestamp: number
  isFinal: boolean
}

// ─── Proctor Types ──────────────────────────────────────────

export type ProctorEventType =
  | 'face_missing'
  | 'multiple_faces'
  | 'gaze_off_screen'
  | 'tab_switch'
  | 'window_blur'
  | 'copy_paste'
  | 'phone_detected'
  | 'second_voice'
  | 'screen_record_attempt'

export interface ProctorEvent {
  type: ProctorEventType
  detail: string
  timestamp: number
  severity: 'low' | 'medium' | 'high'
}

// ─── Code and Whiteboard Snapshot Types ─────────────────────

export interface CodeSnapshot {
  timestamp: number
  content: string
  language: string
  cursorLine: number
  cursorColumn: number
}

export interface WhiteboardSnapshot {
  timestamp: number
  elements: Record<string, unknown>[]
  appStatePartial: Record<string, unknown>
}

// ─── Code Analysis Types ────────────────────────────────────

export type AlgorithmFamily =
  | 'brute_force'
  | 'dynamic_programming'
  | 'greedy'
  | 'graph'
  | 'binary_search'
  | 'divide_conquer'
  | 'two_pointer'
  | 'sliding_window'
  | 'unknown'

export interface ComplexityHint {
  time: string
  space: string
  confidence: number
}

export interface CodeAnalysis {
  algorithmFamily: AlgorithmFamily
  timeComplexityHint: ComplexityHint
  hasNestedLoops: boolean
  recursionDepth: number
  hasEdgeCaseChecks: boolean
  usesBuiltins: string[]
  isPastedCode: boolean
  problemProgress: number
}

// ─── Agent Decision Types ───────────────────────────────────

export interface AgentDecision {
  action: 'follow_up' | 'next_question' | 'probe_deeper' | 'clarify' | 'wrap_up'
  reasoning: string
}

// ─── WebSocket Protocol Types ───────────────────────────────

export type CodeFollowUpTrigger =
  | 'nested_loops'
  | 'brute_force_complete'
  | 'no_edge_cases'
  | 'recursion_no_memo'
  | 'test_case_failed'
  | 'copy_paste_detected'
  | 'solution_correct'
  | 'stuck_3min'
  | 'algorithm_switch'

// Client → Server Messages
export interface SessionJoinPayload {
  token: string
  candidateId: string
  roundNumber: number
  existingSessionId?: string
}

export interface AudioChunkPayload {
  data: string
  sampleRate: number
  sequenceNumber: number
}

export interface CodeUpdatePayload {
  content: string
  language: string
  cursorLine: number
  cursorColumn: number
  snapshotIndex: number
}

export interface CodeRunPayload {
  code: string
  language: string
  testCases: { input: string; expected: string }[]
}

export interface WhiteboardUpdatePayload {
  elements: Record<string, unknown>[]
  appStatePartial: Record<string, unknown>
}

export interface ProctorEventPayload {
  eventType: ProctorEventType
  detail: string
  severity: 'low' | 'medium' | 'high'
  frameTimestamp: number
}

export interface CandidateFinishedPayload {
  reason: 'submitted' | 'timeout'
}

export type ClientMessage =
  | { type: 'session:join'; payload: SessionJoinPayload; timestamp: number; sessionId: string }
  | { type: 'audio:chunk'; payload: AudioChunkPayload; timestamp: number; sessionId: string }
  | { type: 'code:update'; payload: CodeUpdatePayload; timestamp: number; sessionId: string }
  | { type: 'code:run'; payload: CodeRunPayload; timestamp: number; sessionId: string }
  | { type: 'whiteboard:update'; payload: WhiteboardUpdatePayload; timestamp: number; sessionId: string }
  | { type: 'proctor:event'; payload: ProctorEventPayload; timestamp: number; sessionId: string }
  | { type: 'candidate:ready'; payload: Record<string, never>; timestamp: number; sessionId: string }
  | { type: 'candidate:interrupt'; payload: Record<string, never>; timestamp: number; sessionId: string }
  | { type: 'candidate:finished'; payload: CandidateFinishedPayload; timestamp: number; sessionId: string }

// Server → Client Messages
export interface SessionConfirmedPayload {
  sessionId: string
  agentReady: boolean
  resumedFrom: number | null
}

export interface AITextPayload {
  text: string
  isFinal: boolean
  questionIndex: number
  topic: string
}

export interface AIAudioPayload {
  data: string
  sampleRate: number
  sequenceNumber: number
  isLastChunk: boolean
}

export interface AIQuestionPayload {
  questionText: string
  questionIndex: number
  topic: string
  difficulty: string
  problemStatement?: OAProblem
}

export interface CodeFollowUpPayload {
  questionText: string
  triggeredBy: CodeFollowUpTrigger
  problemId: string
}

export interface TestCaseResult {
  input: string
  expected: string
  actual: string
  passed: boolean
  executionMs: number
  memoryMb: number
  error?: string
}

export interface CodeResultPayload {
  testResults: TestCaseResult[]
  executionMs: number
  memoryMb: number
  error?: string
}

export interface TopicCoveredPayload {
  topic: string
  remainingMustCover: string[]
}

export interface TimerUpdatePayload {
  remainingSeconds: number
  totalSeconds: number
  phase: 'normal' | 'warning' | 'overtime'
}

export interface ProctorAcknowledgedPayload {
  eventId: string
  severity: 'low' | 'medium' | 'high'
}

export interface RoundCompletePayload {
  score: number
  recommendation: 'advance' | 'hold' | 'reject'
  summary: string
}

export interface WSErrorPayload {
  code: string
  message: string
  recoverable: boolean
  suggestedAction: string
}

export interface ConnectionQualityPayload {
  latencyMs: number
  quality: 'good' | 'degraded' | 'poor'
}

export type ServerMessage =
  | { type: 'session:confirmed'; payload: SessionConfirmedPayload; timestamp: number; sessionId: string }
  | { type: 'ai:text'; payload: AITextPayload; timestamp: number; sessionId: string }
  | { type: 'ai:audio'; payload: AIAudioPayload; timestamp: number; sessionId: string }
  | { type: 'ai:question'; payload: AIQuestionPayload; timestamp: number; sessionId: string }
  | { type: 'code:followup'; payload: CodeFollowUpPayload; timestamp: number; sessionId: string }
  | { type: 'code:result'; payload: CodeResultPayload; timestamp: number; sessionId: string }
  | { type: 'topic:covered'; payload: TopicCoveredPayload; timestamp: number; sessionId: string }
  | { type: 'timer:update'; payload: TimerUpdatePayload; timestamp: number; sessionId: string }
  | { type: 'proctor:acknowledged'; payload: ProctorAcknowledgedPayload; timestamp: number; sessionId: string }
  | { type: 'round:complete'; payload: RoundCompletePayload; timestamp: number; sessionId: string }
  | { type: 'error'; payload: WSErrorPayload; timestamp: number; sessionId: string }
  | { type: 'connection:quality'; payload: ConnectionQualityPayload; timestamp: number; sessionId: string }

export type WebSocketMessage = ClientMessage | ServerMessage

// ─── Database Row Types (Part 2) ────────────────────────────

export interface OAProblem {
  id: string
  organization_id: string | null
  type: 'mcq' | 'coding'
  difficulty: 'easy' | 'medium' | 'hard'
  topics: string[]
  title: string
  description: string
  options: { id: string; text: string }[] | null
  correct_option_id: string | null
  starter_code: Record<string, string> | null
  test_cases: { input: string; expected: string; isHidden: boolean }[] | null
  solution_reference: Record<string, unknown> | null
  estimated_minutes: number
  created_at: string
}

export interface RecordingFile {
  id: string
  session_id: string
  candidate_id: string
  job_id: string
  organization_id: string
  type: 'video' | 'audio' | 'screen' | 'transcript' | 'code_replay' | 'whiteboard' | 'proctor_log'
  r2_key: string
  size_bytes: number | null
  duration_seconds: number | null
  status: 'processing' | 'ready' | 'failed' | 'expired'
  expires_at: string | null
  created_at: string
}

export interface InterviewCheckpoint {
  id: string
  session_id: string
  candidate_id: string
  checkpoint_data: Record<string, unknown>
  created_at: string
}

export interface SystemCheckResult {
  id: string
  candidate_id: string
  session_id: string | null
  camera_result: Record<string, unknown> | null
  mic_result: Record<string, unknown> | null
  network_result: Record<string, unknown> | null
  browser_result: Record<string, unknown> | null
  overall_pass: boolean
  created_at: string
}

// ─── Report Types ───────────────────────────────────────────

export interface RoundReport extends RoundResult {
  session_id: string | null
  started_at: string | null
  duration_seconds: number | null
  transcript: TranscriptEntry[]
  proctor_log: ProctorEvent[]
  code_replay: CodeSnapshot[]
  whiteboard_snapshots: WhiteboardSnapshot[]
  anti_ai_signals: Record<string, unknown>
  adaptive_difficulty_log: Record<string, unknown>[]
  recordings: RecordingFile[]
  recordingUrls: Record<string, string>
  percentileRank: number
}

export interface CandidateFullReport {
  candidate: Candidate
  job: Job
  rounds: RoundReport[]
  proctoringOverview: {
    overallIntegrity: number
    totalFlags: number
    recommendation: string
  }
  comparativeStats: {
    percentileRank: number
    cohortSize: number
    avgCohortScore: number
    scoreDistribution: ScoreDistributionBucket[]
  }
}

// ─── Prompt Substitution Context ────────────────────────────

export interface PromptSubstitutionContext {
  jobTitle: string
  seniority: string
  durationMinutes: number
  warningAtMinutes: number
  preferredQuestionCount: number
  topics: string
  mustCoverTopics: string
  difficulty: string
}
