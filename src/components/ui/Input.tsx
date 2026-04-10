'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leadingIcon?: LucideIcon
  trailingIcon?: LucideIcon
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[13px] font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {LeadingIcon && (
            <LeadingIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
              LeadingIcon && 'pl-9',
              TrailingIcon && 'pr-9',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
              className
            )}
            {...props}
          />
          {TrailingIcon && (
            <TrailingIcon className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {hint && !error && (
          <p className="mt-1 text-xs text-neutral-400">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
