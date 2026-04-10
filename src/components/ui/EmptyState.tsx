'use client'

import { Button } from './Button'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
        {icon || <Inbox className="h-7 w-7 text-neutral-400" />}
      </div>
      <h3 className="text-base font-medium text-neutral-700">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      )}
      {action && (
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
