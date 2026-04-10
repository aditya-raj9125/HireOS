'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  GripVertical,
  Settings,
} from 'lucide-react'
import { SENIORITY_LEVELS, JOB_TYPES, DEPARTMENTS } from '@/lib/constants'
import { ROUND_TYPE_LABELS } from '@/lib/constants'
import type {
  CreateJobForm,
  PipelineRound,
  RoundType,
  ScoringRubric,
  AutoAdvanceRules,
} from '@/types'
import { cn } from '@/lib/utils'

const steps = ['Job Details', 'Pipeline Setup', 'Scoring Rubric']

const availableRounds: { type: RoundType; name: string }[] = [
  { type: 'online_assessment', name: 'Online Assessment' },
  { type: 'telephonic_screen', name: 'Telephonic Screen' },
  { type: 'live_coding', name: 'Live Coding' },
  { type: 'system_design', name: 'System Design' },
  { type: 'behavioral', name: 'Behavioral' },
  { type: 'technical_deep_dive', name: 'Technical Deep Dive' },
]

export default function CreateJobPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')
  const [jobType, setJobType] = useState('Full-Time')
  const [seniorityLevel, setSeniorityLevel] = useState('')
  const [description, setDescription] = useState('')
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])
  const [niceToHaveSkills, setNiceToHaveSkills] = useState<string[]>([])
  const [targetHeadcount, setTargetHeadcount] = useState(1)
  const [deadline, setDeadline] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [niceSkillInput, setNiceSkillInput] = useState('')

  // Step 2 state
  const [selectedRounds, setSelectedRounds] = useState<PipelineRound[]>([])

  // Step 3 state
  const [skillWeights, setSkillWeights] = useState<
    { skill: string; weight: number; subParams: { name: string; weight: number }[] }[]
  >([])
  const [advanceThreshold, setAdvanceThreshold] = useState(70)
  const [rejectThreshold, setRejectThreshold] = useState(30)

  function addSkill(
    input: string,
    setInput: (v: string) => void,
    skills: string[],
    setSkills: (v: string[]) => void
  ) {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed])
    }
    setInput('')
  }

  function addRound(type: RoundType, name: string) {
    setSelectedRounds((prev) => [
      ...prev,
      {
        id: nanoid(),
        type,
        name,
        order: prev.length + 1,
        config: {},
      },
    ])
  }

  function removeRound(id: string) {
    setSelectedRounds((prev) =>
      prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i + 1 }))
    )
  }

  function initializeSkillWeights() {
    const allSkills = [...requiredSkills]
    const weight = allSkills.length > 0 ? Math.floor(100 / allSkills.length) : 0
    setSkillWeights(
      allSkills.map((skill) => ({
        skill,
        weight,
        subParams: [],
      }))
    )
  }

  function handleNext() {
    if (step === 0) {
      if (!title.trim()) {
        toast.error('Job title is required')
        return
      }
      setStep(1)
    } else if (step === 1) {
      initializeSkillWeights()
      setStep(2)
    }
  }

  async function handleSubmit() {
    setLoading(true)

    const form: CreateJobForm = {
      title,
      department: department || undefined,
      location: location || undefined,
      job_type: jobType.toLowerCase().replace('-', '_'),
      seniority_level: seniorityLevel || undefined,
      description: description || undefined,
      required_skills: requiredSkills,
      nice_to_have_skills: niceToHaveSkills,
      target_headcount: targetHeadcount,
      deadline: deadline || undefined,
      pipeline_config: { rounds: selectedRounds },
      scoring_rubric: { skills: skillWeights },
      auto_advance_rules: {
        advanceThreshold,
        rejectThreshold,
        mustPassSkills: [],
      },
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()

      if (!res.ok) {
        toast.error(result.error ?? 'Failed to create job')
        setLoading(false)
        return
      }

      toast.success('Job created successfully')
      router.push(`/dashboard/jobs/${result.data.id}`)
    } catch {
      toast.error('Something went wrong')
      setLoading(false)
    }
  }

  const totalWeight = skillWeights.reduce((sum, s) => sum + s.weight, 0)

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress stepper */}
      <div className="mb-8 flex items-center justify-center gap-4">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                i <= step
                  ? 'bg-brand-500 text-white'
                  : 'bg-neutral-200 text-neutral-500'
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                'hidden text-sm font-medium sm:block',
                i <= step ? 'text-neutral-900' : 'text-neutral-400'
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-2 h-px w-8 bg-neutral-200" />
            )}
          </div>
        ))}
      </div>

      <Card padding="lg">
        {/* Step 1: Job Details */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-neutral-900">
              Job Details
            </h2>

            <Input
              label="Job Title"
              placeholder="e.g. Senior React Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Department"
                placeholder="e.g. Engineering"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                list="departments"
              />
              <datalist id="departments">
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>

              <Input
                label="Location"
                placeholder="e.g. Bangalore, Remote"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Job Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setJobType(type)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                        jobType === type
                          ? 'border-brand-500 bg-brand-50 text-brand-600'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <Select
                label="Seniority Level"
                options={SENIORITY_LEVELS.map((s) => ({
                  label: s,
                  value: s.toLowerCase(),
                }))}
                value={seniorityLevel}
                onChange={setSeniorityLevel}
                placeholder="Select level…"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                Job Description
              </label>
              <textarea
                className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                rows={4}
                placeholder="Describe the role…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Skills tags */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                Required Skills
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a skill and press Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill(
                        skillInput,
                        setSkillInput,
                        requiredSkills,
                        setRequiredSkills
                      )
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    addSkill(
                      skillInput,
                      setSkillInput,
                      requiredSkills,
                      setRequiredSkills
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {requiredSkills.map((skill) => (
                  <Badge key={skill} variant="teal">
                    {skill}
                    <button
                      onClick={() =>
                        setRequiredSkills((s) => s.filter((x) => x !== skill))
                      }
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                Nice-to-Have Skills
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Type a skill and press Enter"
                  value={niceSkillInput}
                  onChange={(e) => setNiceSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill(
                        niceSkillInput,
                        setNiceSkillInput,
                        niceToHaveSkills,
                        setNiceToHaveSkills
                      )
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    addSkill(
                      niceSkillInput,
                      setNiceSkillInput,
                      niceToHaveSkills,
                      setNiceToHaveSkills
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {niceToHaveSkills.map((skill) => (
                  <Badge key={skill} variant="purple">
                    {skill}
                    <button
                      onClick={() =>
                        setNiceToHaveSkills((s) =>
                          s.filter((x) => x !== skill)
                        )
                      }
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="number"
                label="Target Headcount"
                value={targetHeadcount.toString()}
                onChange={(e) =>
                  setTargetHeadcount(Math.max(1, parseInt(e.target.value) || 1))
                }
                min={1}
                max={100}
              />
              <Input
                type="date"
                label="Application Deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Step 2: Pipeline Setup */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-neutral-900">
              Pipeline Setup
            </h2>
            <p className="text-sm text-neutral-500">
              Select and order the interview rounds for this role.
            </p>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Available rounds */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-neutral-700">
                  Available Rounds
                </h3>
                <div className="space-y-2">
                  {availableRounds.map((round) => (
                    <button
                      key={round.type}
                      type="button"
                      onClick={() => addRound(round.type, round.name)}
                      className="flex w-full items-center justify-between rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-700 transition-colors hover:border-brand-400 hover:bg-brand-50"
                    >
                      {round.name}
                      <Plus className="h-4 w-4 text-neutral-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected rounds */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-neutral-700">
                  Selected Pipeline ({selectedRounds.length} rounds)
                </h3>
                {selectedRounds.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
                    Click rounds to add them
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedRounds.map((round) => (
                      <div
                        key={round.id}
                        className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5"
                      >
                        <GripVertical className="h-4 w-4 text-neutral-300" />
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-100 text-xs font-bold text-brand-700">
                          {round.order}
                        </span>
                        <span className="flex-1 text-sm font-medium text-neutral-700">
                          {round.name}
                        </span>
                        <button
                          type="button"
                          className="text-neutral-400 hover:text-neutral-600"
                          title="Configure"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRound(round.id)}
                          className="text-neutral-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Scoring Rubric */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-medium text-neutral-900">
              Scoring Rubric
            </h2>
            <p className="text-sm text-neutral-500">
              Configure skill weights for evaluation. Weights should sum to 100.
            </p>

            <div className="space-y-3">
              {skillWeights.map((sw, idx) => (
                <div
                  key={sw.skill}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
                >
                  <span className="flex-1 text-sm font-medium text-neutral-700">
                    {sw.skill}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-20 text-center"
                      value={sw.weight.toString()}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setSkillWeights((prev) =>
                          prev.map((s, i) =>
                            i === idx ? { ...s, weight: val } : s
                          )
                        )
                      }}
                      min={0}
                      max={100}
                    />
                    <span className="text-sm text-neutral-400">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={cn(
                'text-sm font-medium',
                totalWeight === 100 ? 'text-green-600' : 'text-red-500'
              )}
            >
              Total: {totalWeight}% {totalWeight !== 100 && '(must be 100%)'}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Auto-Advance Threshold
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={advanceThreshold}
                  onChange={(e) =>
                    setAdvanceThreshold(parseInt(e.target.value))
                  }
                  className="w-full accent-brand-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  ≥ {advanceThreshold}% → Auto-advance
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Auto-Reject Threshold
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={rejectThreshold}
                  onChange={(e) =>
                    setRejectThreshold(parseInt(e.target.value))
                  }
                  className="w-full accent-red-500"
                />
                <p className="mt-1 text-xs text-neutral-500">
                  &lt; {rejectThreshold}% → Auto-reject
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-6">
          <Button
            variant="ghost"
            onClick={() => (step > 0 ? setStep(step - 1) : router.back())}
          >
            <ChevronLeft className="h-4 w-4" />
            {step > 0 ? 'Back' : 'Cancel'}
          </Button>

          {step < 2 ? (
            <Button variant="primary" onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
            >
              Create Job
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
