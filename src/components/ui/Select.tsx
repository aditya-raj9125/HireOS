'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  label: string
  value: string
}

interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  error,
  className,
}: SelectProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          {label}
        </label>
      )}
      <SelectPrimitive.Root value={value} onValueChange={onChange}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-400',
            !value && 'text-neutral-400'
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4 text-neutral-400" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-50 max-h-60 overflow-auto rounded-xl border border-neutral-200 bg-white shadow-modal"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none hover:bg-neutral-50 focus:bg-neutral-50 data-[state=checked]:text-brand-600"
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4 text-brand-500" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
