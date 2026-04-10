'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Link2, Copy, Check, RefreshCw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import type { CandidateInvite } from '@/types'

interface Props {
  candidateId: string
  jobId: string
  existingInvite?: CandidateInvite | null
}

export function InviteLink({ candidateId, jobId, existingInvite }: Props) {
  const [invite, setInvite] = useState<CandidateInvite | null>(
    existingInvite ?? null
  )
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const portalUrl = invite
    ? `${window.location.origin}/portal/${invite.token}`
    : null

  async function generateInvite() {
    setLoading(true)
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: jobId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to generate invite')
        return
      }

      const { data } = await res.json()
      setInvite(data)
      toast.success('Invite link generated')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const statusVariant: Record<string, 'default' | 'warning' | 'teal' | 'danger'> = {
    pending: 'default',
    opened: 'warning',
    started: 'teal',
    expired: 'danger',
  }

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-brand-500" />
        <h3 className="text-sm font-medium text-neutral-900">Invite Link</h3>
      </div>

      {invite ? (
        <>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={portalUrl ?? ''}
              className="flex-1 bg-neutral-50 text-xs"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={copyLink}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <Badge
              variant={statusVariant[invite.status] ?? 'default'}
              size="sm"
            >
              {invite.status}
            </Badge>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires {formatDate(invite.expires_at)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={generateInvite}
            loading={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Regenerate
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onClick={generateInvite}
          loading={loading}
        >
          Generate Invite Link
        </Button>
      )}
    </Card>
  )
}
