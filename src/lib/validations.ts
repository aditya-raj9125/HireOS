import { z } from 'zod'

export const createJobSchema = z.object({
  title: z.string().min(1, 'Job title is required').max(200),
  department: z.string().optional(),
  location: z.string().optional(),
  job_type: z.string().default('full_time'),
  seniority_level: z.string().optional(),
  description: z.string().optional(),
  required_skills: z.array(z.string()).default([]),
  nice_to_have_skills: z.array(z.string()).default([]),
  target_headcount: z.number().int().min(1).max(100).default(1),
  deadline: z.string().optional(),
  pipeline_config: z.object({
    rounds: z.array(
      z.object({
        id: z.string(),
        type: z.enum([
          'online_assessment',
          'telephonic_screen',
          'live_coding',
          'system_design',
          'behavioral',
          'technical_deep_dive',
        ]),
        name: z.string(),
        order: z.number(),
        config: z.object({
          timeLimit: z.number().optional(),
          questionCount: z.number().optional(),
          skills: z.array(z.string()).optional(),
          difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
          customPrompt: z.string().optional(),
        }),
      })
    ),
  }),
  scoring_rubric: z.object({
    skills: z.array(
      z.object({
        skill: z.string(),
        weight: z.number(),
        subParams: z.array(
          z.object({
            name: z.string(),
            weight: z.number(),
          })
        ),
      })
    ),
  }),
  auto_advance_rules: z.object({
    advanceThreshold: z.number().min(0).max(100),
    rejectThreshold: z.number().min(0).max(100),
    mustPassSkills: z.array(z.string()),
  }),
})

export const createCandidateSchema = z.object({
  job_id: z.string().uuid('Invalid job ID'),
  full_name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  source: z.string().default('manual'),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export const inviteSchema = z.object({
  candidate_id: z.string().uuid(),
  job_id: z.string().uuid(),
})
