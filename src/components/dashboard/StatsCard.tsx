import { cn } from '@/lib/utils'

interface StatsCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
}

export function StatsCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-medium text-neutral-900">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-[13px] text-neutral-500">{label}</p>
        {change && (
          <span
            className={cn(
              'text-xs font-medium',
              changeType === 'up' && 'text-green-600',
              changeType === 'down' && 'text-red-500',
              changeType === 'neutral' && 'text-neutral-400'
            )}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  )
}
