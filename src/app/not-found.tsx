import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <Card padding="lg" className="max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-neutral-200">404</p>
        <h1 className="mb-2 text-lg font-semibold text-neutral-900">
          Page not found
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="primary">Go Home</Button>
        </Link>
      </Card>
    </div>
  )
}
