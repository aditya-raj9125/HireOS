import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>

      {/* Table skeletons */}
      <div className="space-y-3">
        <Skeleton variant="text" className="h-6 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="text" className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
