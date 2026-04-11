'use client'

import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import {
  Plus,
  X,
  GripVertical,
  Clock,
  MessageSquareText,
  Brain,
  Shield,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { getRoundTypeDefaults, getDefaultRoundPrompt, TOPIC_SUGGESTIONS } from '@/lib/defaultRoundPrompts'
import { ROUND_TYPE_LABELS } from '@/lib/constants'
import type { PipelineRoundV2, RoundType, RoundConfigV2 } from '@/types'

interface PipelineBuilderProps {
  rounds: PipelineRoundV2[]
  onChange: (rounds: PipelineRoundV2[]) => void
  requiredSkills: string[]
  seniority: string
  bufferDays: number
  onBufferDaysChange: (days: number) => void
  expiresAt: string
  onExpiresAtChange: (date: string) => void
}

const availableRounds: { type: RoundType; name: string }[] = [
  { type: 'online_assessment', name: 'Online Assessment' },
  { type: 'telephonic_screen', name: 'Telephonic Screen' },
  { type: 'live_coding', name: 'Live Coding' },
  { type: 'system_design', name: 'System Design' },
  { type: 'behavioral', name: 'Behavioral' },
  { type: 'technical_deep_dive', name: 'Technical Deep Dive' },
]

const TABS = [
  { id: 'timing', label: 'Timing', icon: Clock },
  { id: 'topics', label: 'Topics & Questions', icon: MessageSquareText },
  { id: 'ai', label: 'AI Behavior', icon: Brain },
  { id: 'rules', label: 'Pass/Fail Rules', icon: Shield },
] as const

type TabId = (typeof TABS)[number]['id']

function createDefaultRound(type: RoundType, order: number, seniority: string): PipelineRoundV2 {
  const defaults = getRoundTypeDefaults(type)
  return {
    id: nanoid(),
    type,
    name: ROUND_TYPE_LABELS[type],
    order,
    durationMinutes: defaults.durationMinutes ?? 30,
    warningAtMinutes: defaults.warningAtMinutes ?? 5,
    preferredQuestionCount: defaults.preferredQuestionCount ?? 6,
    preferredTopics: defaults.preferredTopics ?? [],
    mustCoverTopics: defaults.mustCoverTopics ?? [],
    questionDifficulty: defaults.questionDifficulty ?? 'medium',
    config: {
      evaluationFocus: [],
      customSystemPrompt: getDefaultRoundPrompt(type, seniority),
      allowClarifyingQuestions: true,
      followUpDepth: 3,
      showHintsIfStuck: ['intern', 'junior'].includes(seniority.toLowerCase()),
      allowedLanguages: ['python', 'javascript', 'typescript', 'java', 'cpp', 'go'],
      topicArea: '',
      scaffoldProvided: false,
    },
  }
}

export default function PipelineBuilder({
  rounds,
  onChange,
  requiredSkills,
  seniority,
  bufferDays,
  onBufferDaysChange,
  expiresAt,
  onExpiresAtChange,
}: PipelineBuilderProps) {
  const [expandedRound, setExpandedRound] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('timing')

  const addRound = useCallback(
    (type: RoundType) => {
      const newRound = createDefaultRound(type, rounds.length + 1, seniority)
      onChange([...rounds, newRound])
    },
    [rounds, onChange, seniority]
  )

  const removeRound = useCallback(
    (id: string) => {
      onChange(
        rounds
          .filter((r) => r.id !== id)
          .map((r, i) => ({ ...r, order: i + 1 }))
      )
      if (expandedRound === id) setExpandedRound(null)
    },
    [rounds, onChange, expandedRound]
  )

  const updateRound = useCallback(
    (id: string, updates: Partial<PipelineRoundV2>) => {
      onChange(rounds.map((r) => (r.id === id ? { ...r, ...updates } : r)))
    },
    [rounds, onChange]
  )

  const updateConfig = useCallback(
    (id: string, updates: Partial<RoundConfigV2>) => {
      onChange(
        rounds.map((r) =>
          r.id === id ? { ...r, config: { ...r.config, ...updates } } : r
        )
      )
    },
    [rounds, onChange]
  )

  const totalDuration = rounds.reduce((sum, r) => sum + r.durationMinutes, 0)

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-medium text-neutral-900">Pipeline Setup</h2>
      <p className="text-sm text-neutral-500">
        Select, order, and configure interview rounds.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Available rounds */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-neutral-700">Available Rounds</h3>
          <div className="space-y-2">
            {availableRounds.map((round) => (
              <button
                key={round.type}
                type="button"
                onClick={() => addRound(round.type)}
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
            Selected Pipeline ({rounds.length} rounds)
          </h3>
          {rounds.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
              Click rounds to add them
            </div>
          ) : (
            <div className="space-y-3">
              {rounds.map((round) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  expanded={expandedRound === round.id}
                  onToggle={() =>
                    setExpandedRound(expandedRound === round.id ? null : round.id)
                  }
                  onRemove={() => removeRound(round.id)}
                  onUpdate={(updates) => updateRound(round.id, updates)}
                  onUpdateConfig={(updates) => updateConfig(round.id, updates)}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  requiredSkills={requiredSkills}
                  seniority={seniority}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline footer summary */}
      {rounds.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium text-neutral-700">
              Total: {totalDuration} min across {rounds.length} rounds
            </span>
            <div className="flex items-center gap-2">
              <label className="text-neutral-500">Buffer days:</label>
              <input
                type="number"
                min={0}
                max={30}
                value={bufferDays}
                onChange={(e) => onBufferDaysChange(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 rounded border border-neutral-300 px-2 py-1 text-center text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-neutral-500">Expires:</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => onExpiresAtChange(e.target.value)}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Round Card Accordion ────────────────────────────────────

interface RoundCardProps {
  round: PipelineRoundV2
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  onUpdate: (u: Partial<PipelineRoundV2>) => void
  onUpdateConfig: (u: Partial<RoundConfigV2>) => void
  activeTab: TabId
  onTabChange: (t: TabId) => void
  requiredSkills: string[]
  seniority: string
}

function RoundCard({
  round,
  expanded,
  onToggle,
  onRemove,
  onUpdate,
  onUpdateConfig,
  activeTab,
  onTabChange,
  requiredSkills,
  seniority,
}: RoundCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      {/* Header — collapsed summary */}
      <div
        className="flex cursor-pointer items-center gap-2 px-3 py-2.5"
        onClick={onToggle}
      >
        <GripVertical className="h-4 w-4 text-neutral-300" />
        <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-100 text-xs font-bold text-brand-700">
          {round.order}
        </span>
        <span className="flex-1 text-sm font-medium text-neutral-700">
          {round.name}
        </span>
        <Badge variant="default">{round.durationMinutes} min</Badge>
        <Badge variant="default">{round.preferredQuestionCount} Qs</Badge>
        {round.preferredTopics.length > 0 && (
          <Badge variant="default">{round.preferredTopics.length} topics</Badge>
        )}
        {round.mustCoverTopics.length > 0 && (
          <Badge variant="warning">{round.mustCoverTopics.length} must-cover</Badge>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="text-neutral-400 hover:text-red-500"
        >
          <X className="h-4 w-4" />
        </button>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-neutral-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-neutral-400" />
        )}
      </div>

      {/* Expanded config tabs */}
      {expanded && (
        <div className="border-t border-neutral-200 p-4">
          {/* Tab bar */}
          <div className="mb-4 flex gap-1 rounded-lg bg-neutral-100 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-white text-brand-600 shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {activeTab === 'timing' && (
            <TimingTab round={round} onUpdate={onUpdate} />
          )}
          {activeTab === 'topics' && (
            <TopicsTab round={round} onUpdate={onUpdate} />
          )}
          {activeTab === 'ai' && (
            <AIBehaviorTab
              round={round}
              onUpdate={onUpdate}
              onUpdateConfig={onUpdateConfig}
              requiredSkills={requiredSkills}
              seniority={seniority}
            />
          )}
          {activeTab === 'rules' && (
            <PassFailTab round={round} onUpdateConfig={onUpdateConfig} requiredSkills={requiredSkills} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab 1: Timing ──────────────────────────────────────────

function TimingTab({
  round,
  onUpdate,
}: {
  round: PipelineRoundV2
  onUpdate: (u: Partial<PipelineRoundV2>) => void
}) {
  const warningRatio = round.warningAtMinutes / round.durationMinutes
  const interviewWidth = Math.max(0, Math.min(100, (1 - warningRatio) * 100))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="number"
          label="Total Duration (minutes)"
          value={round.durationMinutes.toString()}
          onChange={(e) =>
            onUpdate({ durationMinutes: Math.max(5, parseInt(e.target.value) || 5) })
          }
          min={5}
          max={180}
        />
        <Input
          type="number"
          label="Warn at (minutes remaining)"
          value={round.warningAtMinutes.toString()}
          onChange={(e) =>
            onUpdate({
              warningAtMinutes: Math.max(1, parseInt(e.target.value) || 1),
            })
          }
          min={1}
          max={round.durationMinutes}
        />
      </div>

      {/* Timing visualization bar */}
      <div className="mt-2">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          <div
            className="bg-brand-500 transition-all"
            style={{ width: `${interviewWidth}%` }}
          />
          <div
            className="bg-amber-400 transition-all"
            style={{ width: `${100 - interviewWidth}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-500">
          <span>Interview ({round.durationMinutes - round.warningAtMinutes} min)</span>
          <span>Warning zone ({round.warningAtMinutes} min)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Tab 2: Topics & Questions ──────────────────────────────

function TopicsTab({
  round,
  onUpdate,
}: {
  round: PipelineRoundV2
  onUpdate: (u: Partial<PipelineRoundV2>) => void
}) {
  const [topicInput, setTopicInput] = useState('')
  const [mustCoverInput, setMustCoverInput] = useState('')
  const suggestions = TOPIC_SUGGESTIONS[round.type] ?? []

  const addPreferredTopic = (topic: string) => {
    const t = topic.trim()
    if (t && !round.preferredTopics.includes(t)) {
      onUpdate({ preferredTopics: [...round.preferredTopics, t] })
    }
    setTopicInput('')
  }

  const addMustCover = (topic: string) => {
    const t = topic.trim()
    if (t && !round.mustCoverTopics.includes(t)) {
      onUpdate({ mustCoverTopics: [...round.mustCoverTopics, t] })
    }
    setMustCoverInput('')
  }

  const difficulties = ['easy', 'medium', 'hard', 'adaptive'] as const

  return (
    <div className="space-y-4">
      <Input
        type="number"
        label="Target Question Count"
        value={round.preferredQuestionCount.toString()}
        onChange={(e) =>
          onUpdate({
            preferredQuestionCount: Math.min(25, Math.max(3, parseInt(e.target.value) || 3)),
          })
        }
        min={3}
        max={25}
      />

      {/* Preferred topics */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Preferred Topics
        </label>
        <div className="flex gap-2">
          <input
            placeholder="Type and press Enter"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPreferredTopic(topicInput)
              }
            }}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {round.preferredTopics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
            >
              {t}
              <button
                onClick={() =>
                  onUpdate({ preferredTopics: round.preferredTopics.filter((x) => x !== t) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions
            .filter((s) => !round.preferredTopics.includes(s))
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addPreferredTopic(s)}
                className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-200"
              >
                + {s}
              </button>
            ))}
        </div>
      </div>

      {/* Must-cover topics */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Must-Cover Topics
        </label>
        <div className="flex gap-2">
          <input
            placeholder="Type and press Enter"
            value={mustCoverInput}
            onChange={(e) => setMustCoverInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addMustCover(mustCoverInput)
              }
            }}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {round.mustCoverTopics.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
            >
              {t}
              <button
                onClick={() =>
                  onUpdate({ mustCoverTopics: round.mustCoverTopics.filter((x) => x !== t) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-amber-600">
          The AI will not conclude this round until all must-cover topics have been addressed.
        </p>
      </div>

      {/* Difficulty selector */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Question Difficulty
        </label>
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {difficulties.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onUpdate({ questionDifficulty: d })}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                round.questionDifficulty === d
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              {d}
            </button>
          ))}
        </div>
        {round.questionDifficulty === 'adaptive' && (
          <p className="mt-1 flex items-center gap-1 text-xs text-brand-600">
            <Info className="h-3 w-3" />
            Difficulty adjusts automatically based on real-time performance.
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Tab 3: AI Behavior ─────────────────────────────────────

function AIBehaviorTab({
  round,
  onUpdate,
  onUpdateConfig,
  requiredSkills,
  seniority,
}: {
  round: PipelineRoundV2
  onUpdate: (u: Partial<PipelineRoundV2>) => void
  onUpdateConfig: (u: Partial<RoundConfigV2>) => void
  requiredSkills: string[]
  seniority: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Custom AI Prompt
        </label>
        <textarea
          className="w-full rounded-lg border border-neutral-300 p-3 font-mono text-xs text-neutral-800 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          rows={8}
          value={round.config.customSystemPrompt}
          onChange={(e) => onUpdateConfig({ customSystemPrompt: e.target.value })}
        />
      </div>

      {/* Evaluation focus */}
      {requiredSkills.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
            Evaluation Focus
          </label>
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill) => {
              const selected = round.config.evaluationFocus.includes(skill)
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      evaluationFocus: selected
                        ? round.config.evaluationFocus.filter((s) => s !== skill)
                        : [...round.config.evaluationFocus, skill],
                    })
                  }
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-neutral-100 text-neutral-500'
                  )}
                >
                  {skill}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Toggles */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-700">Allow clarifying questions</span>
        <button
          type="button"
          onClick={() =>
            onUpdateConfig({
              allowClarifyingQuestions: !round.config.allowClarifyingQuestions,
            })
          }
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            round.config.allowClarifyingQuestions ? 'bg-brand-500' : 'bg-neutral-300'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              round.config.allowClarifyingQuestions ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          AI Follow-up Depth: {round.config.followUpDepth}
        </label>
        <input
          type="range"
          min={1}
          max={5}
          value={round.config.followUpDepth}
          onChange={(e) =>
            onUpdateConfig({
              followUpDepth: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5,
            })
          }
          className="w-full accent-brand-500"
        />
        <div className="flex justify-between text-xs text-neutral-400">
          <span>Surface</span>
          <span>Deep dive</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-700">Provide hints if stuck</span>
        <button
          type="button"
          onClick={() =>
            onUpdateConfig({ showHintsIfStuck: !round.config.showHintsIfStuck })
          }
          className={cn(
            'relative h-6 w-11 rounded-full transition-colors',
            round.config.showHintsIfStuck ? 'bg-brand-500' : 'bg-neutral-300'
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
              round.config.showHintsIfStuck ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )
}

// ─── Tab 4: Pass/Fail Rules ─────────────────────────────────

function PassFailTab({
  round,
  onUpdateConfig,
  requiredSkills,
}: {
  round: PipelineRoundV2
  onUpdateConfig: (u: Partial<RoundConfigV2>) => void
  requiredSkills: string[]
}) {
  const config = round.config
  const configRecord = config as unknown as Record<string, unknown>
  const advanceThreshold = configRecord.autoAdvanceThreshold as number ?? 70
  const rejectThreshold = configRecord.autoRejectThreshold as number ?? 30
  const mustPassSkills = configRecord.mustPassSkills as string[] ?? []
  const hasOverlap = rejectThreshold >= advanceThreshold

  const setThreshold = (key: string, value: number) => {
    onUpdateConfig({ [key]: value } as Partial<RoundConfigV2>)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Auto-Advance Threshold: ≥ {advanceThreshold}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={advanceThreshold}
          onChange={(e) =>
            setThreshold('autoAdvanceThreshold', parseInt(e.target.value))
          }
          className="w-full accent-brand-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          Auto-Reject Threshold: &lt; {rejectThreshold}%
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={rejectThreshold}
          onChange={(e) =>
            setThreshold('autoRejectThreshold', parseInt(e.target.value))
          }
          className="w-full accent-red-500"
        />
      </div>

      {hasOverlap && (
        <p className="text-xs font-medium text-red-500">
          Reject threshold must be lower than advance threshold.
        </p>
      )}

      {/* Three-zone visualization */}
      <div className="mt-2">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          <div className="bg-red-400" style={{ width: `${rejectThreshold}%` }} />
          <div
            className="bg-amber-300"
            style={{ width: `${Math.max(0, advanceThreshold - rejectThreshold)}%` }}
          />
          <div className="bg-green-400" style={{ width: `${100 - advanceThreshold}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
          <span>Auto-reject</span>
          <span>HR review</span>
          <span>Auto-advance</span>
        </div>
      </div>

      {/* Must-pass skills */}
      {requiredSkills.length > 0 && (
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
            Must-Pass Skills
          </label>
          <div className="space-y-1">
            {requiredSkills.map((skill) => {
              const checked = mustPassSkills.includes(skill)
              return (
                <label key={skill} className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setThreshold(
                        'mustPassSkills',
                        checked
                          ? (mustPassSkills.filter((s: string) => s !== skill) as unknown as number)
                          : ([...mustPassSkills, skill] as unknown as number)
                      )
                    }
                    className="h-4 w-4 rounded border-neutral-300 accent-brand-500"
                  />
                  {skill}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
