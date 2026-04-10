'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import {
  X,
  Upload,
  UserPlus,
  Plus,
  FileText,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import toast from 'react-hot-toast'
import { CANDIDATE_SOURCES } from '@/lib/constants'

interface Props {
  jobId: string
  onSuccess?: () => void
}

export function AddCandidateModal({ jobId, onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'manual' | 'csv'>('manual')
  const [loading, setLoading] = useState(false)

  // Manual fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('manual')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')

  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null)

  function reset() {
    setFullName('')
    setEmail('')
    setPhone('')
    setSource('manual')
    setTags([])
    setTagInput('')
    setNotes('')
    setCsvFile(null)
    setMode('manual')
  }

  async function handleManualSubmit() {
    if (!fullName.trim() || !email.trim()) {
      toast.error('Name and email are required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          source,
          tags,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to add candidate')
        return
      }

      toast.success('Candidate added')
      reset()
      setOpen(false)
      onSuccess?.()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleCsvUpload() {
    if (!csvFile) {
      toast.error('Select a CSV file')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('job_id', jobId)

      const res = await fetch('/api/candidates/bulk', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Upload failed')
        return
      }

      const data = await res.json()
      toast.success(`${data.count} candidates imported`)
      reset()
      setOpen(false)
      onSuccess?.()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="primary" size="sm">
          <UserPlus className="h-4 w-4" />
          Add Candidate
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-900">
              Add Candidate
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-neutral-400 hover:text-neutral-600">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Mode toggle */}
          <div className="mb-5 flex rounded-lg border border-neutral-200 p-0.5">
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500'
              }`}
            >
              <UserPlus className="mr-1.5 inline-block h-4 w-4" />
              Manual Entry
            </button>
            <button
              onClick={() => setMode('csv')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === 'csv'
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-500'
              }`}
            >
              <FileText className="mr-1.5 inline-block h-4 w-4" />
              CSV Upload
            </button>
          </div>

          {mode === 'manual' ? (
            <div className="space-y-4">
              <Input
                label="Full Name"
                placeholder="e.g. Priya Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email"
                type="email"
                placeholder="priya@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Source
                </label>
                <div className="flex flex-wrap gap-2">
                  {CANDIDATE_SOURCES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                        source === s
                          ? 'border-brand-500 bg-brand-50 text-brand-600'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
                  Tags
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag…"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const t = tagInput.trim()
                        if (t && !tags.includes(t)) setTags([...tags, t])
                        setTagInput('')
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      const t = tagInput.trim()
                      if (t && !tags.includes(t)) setTags([...tags, t])
                      setTagInput('')
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="default">
                      {tag}
                      <button
                        onClick={() => setTags((t) => t.filter((x) => x !== tag))}
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
                  Notes
                </label>
                <textarea
                  className="w-full rounded-lg border border-neutral-300 p-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes…"
                />
              </div>

              <Button
                variant="primary"
                className="w-full"
                loading={loading}
                onClick={handleManualSubmit}
              >
                Add Candidate
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Card className="relative flex cursor-pointer flex-col items-center gap-3 border-dashed py-8 text-center">
                <Upload className="h-8 w-8 text-neutral-400" />
                <p className="text-sm text-neutral-600">
                  {csvFile ? csvFile.name : 'Drop CSV or click to upload'}
                </p>
                <p className="text-xs text-neutral-400">
                  Columns: full_name, email, phone (optional), source (optional)
                </p>
                <input
                  type="file"
                  accept=".csv"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </Card>
              <Button
                variant="primary"
                className="w-full"
                loading={loading}
                onClick={handleCsvUpload}
                disabled={!csvFile}
              >
                Import Candidates
              </Button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
