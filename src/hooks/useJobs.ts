import { useState, useEffect, useCallback } from 'react'
import type { Job, PaginatedResponse } from '@/types'

interface UseJobsOptions {
  status?: string
  page?: number
  pageSize?: number
}

export function useJobs(options: UseJobsOptions = {}) {
  const { status, page = 1, pageSize = 20 } = options
  const [data, setData] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      params.set('page', page.toString())
      params.set('pageSize', pageSize.toString())

      const res = await fetch(`/api/jobs?${params}`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Failed to fetch jobs')
      }

      const result: PaginatedResponse<Job> = await res.json()
      setData(result.data)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [status, page, pageSize])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  return { data, total, loading, error, refetch: fetchJobs }
}
