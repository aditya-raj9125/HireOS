'use client'

import { Bell } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TopBarProps {
  title: string
  profile: { full_name: string | null; email: string } | null
}

export function TopBar({ title, profile }: TopBarProps) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?'

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <h1 className="text-lg font-medium text-neutral-900">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              aria-label="User menu"
            >
              {initials}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[180px] rounded-xl border border-neutral-200 bg-white p-1 shadow-modal"
              align="end"
              sideOffset={8}
            >
              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard/settings"
                  className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none hover:bg-neutral-50 focus:bg-neutral-50"
                >
                  Profile
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard/settings"
                  className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-neutral-700 outline-none hover:bg-neutral-50 focus:bg-neutral-50"
                >
                  Settings
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50"
                onSelect={handleSignOut}
              >
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
