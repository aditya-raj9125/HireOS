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
