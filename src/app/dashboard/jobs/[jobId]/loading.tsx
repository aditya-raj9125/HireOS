import { Skeleton } from '@/components/ui/Skeleton'

export default function JobDetailLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton variant="text" className="h-8 w-64" />
        <Skeleton variant="text" className="h-4 w-96" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="text" className="h-6 w-20" />
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 flex-shrink-0 space-y-3 rounded-xl border border-neutral-200 p-4">
            <Skeleton variant="text" className="h-5 w-32" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ))}
      </div>
    </div>
  )
}
