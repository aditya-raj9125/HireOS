import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingStyles = {
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
}

export function Card({
  children,
  className,
  padding = 'md',
  hover = false,
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white shadow-card',
        paddingStyles[padding],
        hover &&
          'transition-all duration-200 hover:scale-[1.005] hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  )
}
