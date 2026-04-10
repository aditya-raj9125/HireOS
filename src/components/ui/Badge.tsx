import { cn } from '@/lib/utils'

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'teal'
  | 'purple'

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-neutral-100 text-neutral-600',
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-600',
  info: 'bg-blue-50 text-blue-700',
  teal: 'bg-brand-50 text-brand-700',
  purple: 'bg-purple-50 text-purple-700',
}

interface BadgeProps {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
}

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        variantStyles[variant],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
    >
      {children}
    </span>
  )
}
