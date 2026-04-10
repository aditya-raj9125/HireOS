'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
        <Card padding="lg" className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-neutral-900">
            Something went wrong
          </h1>
          <p className="mb-6 text-sm text-neutral-500">
            An unexpected error occurred. Please try again.
          </p>
          <Button variant="primary" onClick={reset}>
            Try Again
          </Button>
        </Card>
      </body>
    </html>
  )
}
