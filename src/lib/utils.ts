import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format as fnsFormat } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(
  date: string | Date,
  formatStr: string = 'MMM d, yyyy'
): string {
  return fnsFormat(new Date(date), formatStr)
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

export function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '—'
  return `${score.toFixed(1)}%`
}
