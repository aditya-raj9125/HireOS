import { useState, useEffect, useCallback } from 'react'
import type { Candidate, PaginatedResponse } from '@/types'

interface UseCandidatesOptions {
  jobId?: string
  status?: string
  page?: number
  pageSize?: number
}

export function useCandidates(options: UseCandidatesOptions = {}) {
  const { jobId, status, page = 1, pageSize = 50 } = options
  const [data, setData] = useState<Candidate[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCandidates = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (jobId) params.set('job_id', jobId)
      if (status) params.set('status', status)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())

      const res = await fetch(`/api/candidates?${params}`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to fetch candidates')
      }

      const result: PaginatedResponse<Candidate> = await res.json()
      setData(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [jobId, status, page, pageSize])

  useEffect(() => {
    fetchCandidates()
  }, [fetchCandidates])

  return { data, total, loading, error, refetch: fetchCandidates }
}
