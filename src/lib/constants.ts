import type { RoundType } from '@/types'

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  online_assessment: 'Online Assessment',
  telephonic_screen: 'Telephonic Screen',
  live_coding: 'Live Coding',
  system_design: 'System Design',
  behavioral: 'Behavioral',
  technical_deep_dive: 'Technical Deep Dive',
}

export const ROUND_TYPE_ICONS: Record<RoundType, string> = {
  online_assessment: 'ClipboardList',
  telephonic_screen: 'Phone',
  live_coding: 'Code2',
  system_design: 'Layout',
  behavioral: 'MessageSquare',
  technical_deep_dive: 'Microscope',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  active: 'bg-green-50 text-green-700',
  paused: 'bg-amber-50 text-amber-700',
  closed: 'bg-neutral-100 text-neutral-500',
}

export const CANDIDATE_STATUS_COLORS: Record<string, string> = {
  invited: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-brand-50 text-brand-700',
  completed: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-600',
  hired: 'bg-brand-50 text-brand-600',
  on_hold: 'bg-amber-50 text-amber-700',
}

export const SENIORITY_LEVELS = [
  'Intern',
  'Junior',
  'Mid',
  'Senior',
  'Staff',
  'Principal',
] as const

export const JOB_TYPES = [
  'Full-Time',
  'Part-Time',
  'Contract',
  'Remote',
] as const

export const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Data',
  'DevOps',
] as const

export const CANDIDATE_SOURCES = [
  'Manual',
  'CSV Upload',
  'Naukri',
  'LinkedIn',
  'Referral',
  'Other',
] as const
