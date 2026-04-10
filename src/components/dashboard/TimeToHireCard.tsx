import { Card } from '@/components/ui/Card'
import { Clock, TrendingDown, TrendingUp } from 'lucide-react'

interface Props {
  avgDays: number
  change?: number // % change from previous period
}

export function TimeToHireCard({ avgDays, change }: Props) {
  const isImproving = change !== undefined && change < 0

  return (
    <Card padding="md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500">Avg. Time to Hire</p>
          <p className="mt-1 text-3xl font-semibold text-neutral-900">
            {avgDays}
            <span className="ml-1 text-base font-normal text-neutral-400">
              days
            </span>
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
          <Clock className="h-5 w-5 text-brand-500" />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1.5 text-sm">
          {isImproving ? (
            <TrendingDown className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-red-500" />
          )}
          <span
            className={
              isImproving ? 'text-green-600' : 'text-red-600'
            }
          >
            {Math.abs(change)}%
          </span>
          <span className="text-neutral-400">vs last period</span>
        </div>
      )}
    </Card>
  )
}
