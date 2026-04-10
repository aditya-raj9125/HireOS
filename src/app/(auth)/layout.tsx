import { Bird } from 'lucide-react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4"
      style={{
        backgroundImage:
          'radial-gradient(circle, #d6d3d1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="mb-8 flex flex-col items-center">
        <div className="flex items-center gap-2">
          <Bird className="h-8 w-8 text-brand-500" />
          <span className="text-2xl font-bold text-brand-500">HireOS</span>
        </div>
        <p className="mt-1 text-sm text-neutral-400">
          Agentic AI Interview Platform
        </p>
      </div>
      {children}
    </div>
  )
}
