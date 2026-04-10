import { Skeleton } from '@/components/ui/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton variant="text" className="h-8 w-32" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton variant="card" className="h-80" />
        <Skeleton variant="card" className="h-80" />
      </div>
    </div>
  )
}
