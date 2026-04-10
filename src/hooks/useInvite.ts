import { useState, useCallback } from 'react'
import type { CandidateInvite } from '@/types'
import toast from 'react-hot-toast'

export function useInvite() {
  const [loading, setLoading] = useState(false)
  const [invite, setInvite] = useState<CandidateInvite | null>(null)

  const generateInvite = useCallback(
    async (candidateId: string, jobId: string) => {
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
          return null
        }

        const { data } = await res.json()
        setInvite(data)
        return data as CandidateInvite
      } catch {
        toast.error('Something went wrong')
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { invite, loading, generateInvite }
}
