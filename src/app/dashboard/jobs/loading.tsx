import { Skeleton } from '@/components/ui/Skeleton'

export default function JobsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="h-8 w-48" />
        <Skeleton variant="text" className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="card" />
        ))}
      </div>
    </div>
  )
}
