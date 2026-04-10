import { cn } from '@/lib/utils'

interface SkeletonProps {
  variant?: 'text' | 'card' | 'circle'
  className?: string
}

export function Skeleton({ variant = 'text', className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-shimmer',
        variant === 'text' && 'h-4 rounded',
        variant === 'card' && 'h-32 rounded-xl',
        variant === 'circle' && 'h-10 w-10 rounded-full',
        className
      )}
    />
  )
}
