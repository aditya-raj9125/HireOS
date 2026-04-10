'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bird,
  LayoutDashboard,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navSections = [
  {
    label: 'Hiring',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Jobs', href: '/dashboard/jobs', icon: Briefcase },
      { label: 'Candidates', href: '/dashboard/candidates', icon: Users },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

interface SidebarProps {
  profile: { full_name: string | null; email: string } | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-screen w-60 flex-col border-r border-neutral-200 bg-white lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-neutral-200 px-5">
        <Bird className="h-5 w-5 text-brand-500" />
        <span className="text-base font-bold text-neutral-900">HireOS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => (
          <div key={section.label} className="mb-6">
            <p className="mb-2 px-2 text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
              {section.label}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'mb-0.5 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-l-[3px] border-l-brand-500 bg-brand-50 text-brand-600'
                      : 'text-neutral-700 hover:bg-neutral-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-neutral-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {profile?.full_name
              ? profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
              : '?'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-neutral-900">
              {profile?.full_name ?? 'HR User'}
            </p>
            <p className="truncate text-xs text-neutral-400">
              {profile?.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-700"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
