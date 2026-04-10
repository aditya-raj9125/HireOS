'use client'

import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { usePathname } from 'next/navigation'

interface DashboardShellProps {
  profile: { full_name: string | null; email: string } | null
  children: React.ReactNode
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/jobs': 'Jobs',
  '/dashboard/jobs/new': 'Create New Job',
  '/dashboard/candidates': 'Candidates',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
}

export function DashboardShell({ profile, children }: DashboardShellProps) {
  const pathname = usePathname()

  const title =
    pageTitles[pathname] ||
    (pathname.includes('/jobs/') ? 'Job Details' : 'Dashboard')

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar profile={profile} />
      <div className="lg:ml-60">
        <TopBar title={title} profile={profile} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
