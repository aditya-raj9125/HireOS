'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  LayoutGrid,
  List,
  ChevronRight,
  UserPlus,
  Mail,
} from 'lucide-react'
import type { CandidateStatus, CandidateWithRounds, PipelineRound } from '@/types'
import { cn, formatScore } from '@/lib/utils'
import Link from 'next/link'

type View = 'kanban' | 'table'

const CANDIDATE_BADGE_VARIANT: Record<string, 'default' | 'info' | 'teal' | 'success' | 'danger' | 'warning'> = {
  invited: 'info',
  in_progress: 'teal',
  completed: 'success',
  rejected: 'danger',
  hired: 'teal',
  on_hold: 'warning',
}

interface Props {
  jobId: string
  candidates: CandidateWithRounds[]
  rounds: PipelineRound[]
}

export function CandidatePipelineView({ jobId, candidates, rounds }: Props) {
  const [view, setView] = useState<View>('kanban')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Group candidates by their current_round
  const columns = rounds.map((round) => ({
    round,
    candidates: candidates.filter(
      (c) => c.current_round === round.order
    ),
  }))

  // Also add a "Completed" column for candidates who passed all rounds
  const completedCandidates = candidates.filter(
    (c) => c.current_round > rounds.length || c.status === 'completed' || c.status === 'hired'
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-neutral-900">
            Candidates ({candidates.length})
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/jobs/${jobId}/add-candidate`}>
            <Button variant="primary" size="sm">
              <UserPlus className="h-4 w-4" />
              Add Candidate
            </Button>
          </Link>

          <div className="flex rounded-lg border border-neutral-200 p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm',
                view === 'kanban'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-sm',
                view === 'table'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-700'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6" />}
          title="No candidates yet"
          description="Add candidates manually or send invite links to get started."
        />
      ) : view === 'kanban' ? (
        <KanbanView
          columns={columns}
          completedCandidates={completedCandidates}
          jobId={jobId}
        />
      ) : (
        <TableView
          candidates={candidates}
          rounds={rounds}
          jobId={jobId}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
        />
      )}

      {/* Quick Actions floating bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-lg">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-700">
              {selectedIds.length} selected
            </span>
            <Button variant="secondary" size="sm">
              <Mail className="h-3.5 w-3.5" />
              Send Invite
            </Button>
            <Button variant="secondary" size="sm">
              Advance
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Kanban View ────────────────────────────────────────── */

function KanbanView({
  columns,
  completedCandidates,
  jobId,
}: {
  columns: { round: PipelineRound; candidates: CandidateWithRounds[] }[]
  completedCandidates: CandidateWithRounds[]
  jobId: string
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map(({ round, candidates }) => (
        <div
          key={round.id}
          className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-neutral-200 bg-neutral-50"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <h3 className="text-sm font-medium text-neutral-700">
              {round.name}
            </h3>
            <Badge variant="default" size="sm">
              {candidates.length}
            </Badge>
          </div>
          <div className="flex-1 space-y-2 p-3">
            {candidates.map((c) => (
              <CandidateKanbanCard key={c.id} candidate={c} jobId={jobId} />
            ))}
            {candidates.length === 0 && (
              <p className="py-4 text-center text-xs text-neutral-400">
                No candidates
              </p>
            )}
          </div>
        </div>
      ))}

      {/* Completed column */}
      <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-green-200 bg-green-50/50">
        <div className="flex items-center justify-between border-b border-green-200 px-4 py-3">
          <h3 className="text-sm font-medium text-green-700">Completed</h3>
          <Badge variant="teal" size="sm">
            {completedCandidates.length}
          </Badge>
        </div>
        <div className="flex-1 space-y-2 p-3">
          {completedCandidates.map((c) => (
            <CandidateKanbanCard key={c.id} candidate={c} jobId={jobId} />
          ))}
          {completedCandidates.length === 0 && (
            <p className="py-4 text-center text-xs text-neutral-400">
              No candidates
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function CandidateKanbanCard({
  candidate,
  jobId,
}: {
  candidate: CandidateWithRounds
  jobId: string
}) {
  const badgeVariant = CANDIDATE_BADGE_VARIANT[candidate.status] ?? 'default'
  return (
    <Link href={`/dashboard/jobs/${jobId}/candidates/${candidate.id}`}>
      <Card hover className="!p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {candidate.full_name}
            </p>
            <p className="text-xs text-neutral-500">{candidate.email}</p>
          </div>
          <Badge
            variant={badgeVariant}
            size="sm"
          >
            {candidate.status.replace('_', ' ')}
          </Badge>
        </div>
        {candidate.overall_score !== null && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-neutral-400">Score</span>
            <span className="text-sm font-semibold text-neutral-700">
              {formatScore(candidate.overall_score)}
            </span>
          </div>
        )}
        {candidate.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {candidate.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  )
}

/* ─── Table View ─────────────────────────────────────────── */

function TableView({
  candidates,
  rounds,
  jobId,
  selectedIds,
  toggleSelect,
}: {
  candidates: CandidateWithRounds[]
  rounds: PipelineRound[]
  jobId: string
  selectedIds: string[]
  toggleSelect: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr>
            <th className="px-4 py-3">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                onChange={(e) => {
                  // select all / deselect all
                }}
              />
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">Name</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Round</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Score</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Source</th>
            <th className="w-10 px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {candidates.map((c) => {
            const badgeVar = CANDIDATE_BADGE_VARIANT[c.status] ?? 'default'
            const currentRound = rounds.find(
              (r) => r.order === c.current_round
            )

            return (
              <tr
                key={c.id}
                className="transition-colors hover:bg-neutral-50"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded border-neutral-300"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/jobs/${jobId}/candidates/${c.id}`}
                    className="font-medium text-neutral-900 hover:text-brand-600"
                  >
                    {c.full_name}
                  </Link>
                  <p className="text-xs text-neutral-500">{c.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={badgeVar}
                    size="sm"
                  >
                    {c.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {currentRound?.name ?? 'Completed'}
                </td>
                <td className="px-4 py-3 font-medium text-neutral-700">
                  {c.overall_score !== null
                    ? formatScore(c.overall_score)
                    : '—'}
                </td>
                <td className="px-4 py-3 text-neutral-500 capitalize">
                  {c.source}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/jobs/${jobId}/candidates/${c.id}`}
                  >
                    <ChevronRight className="h-4 w-4 text-neutral-400" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
