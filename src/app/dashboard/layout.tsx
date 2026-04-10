import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const service = createServiceRoleClient()

  // Check if profile exists
  const { data: profile } = await service
    .from('profiles')
    .select('full_name, email, organization_id')
    .eq('id', user.id)
    .single()

  // Auto-create profile + organization if missing
  if (!profile) {
    const userName =
      user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'

    const { data: newOrg } = await service
      .from('organizations')
      .insert({
        name: `${userName}'s Organization`,
        slug: `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id.slice(0, 8)}`,
      })
      .select('id')
      .single()

    if (newOrg) {
      await service.from('profiles').insert({
        id: user.id,
        organization_id: newOrg.id,
        full_name: userName,
        email: user.email!,
        role: 'hr',
      })
    }
  } else if (!profile.organization_id) {
    // Profile exists but has no org — create and link one
    const userName = profile.full_name ?? user.email?.split('@')[0] ?? 'User'

    const { data: newOrg } = await service
      .from('organizations')
      .insert({
        name: `${userName}'s Organization`,
        slug: `${userName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.id.slice(0, 8)}`,
      })
      .select('id')
      .single()

    if (newOrg) {
      await service
        .from('profiles')
        .update({ organization_id: newOrg.id })
        .eq('id', user.id)
    }
  }

  // Re-fetch profile for display (only need name + email)
  const { data: displayProfile } = await service
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  return (
    <DashboardShell profile={displayProfile}>
      {children}
    </DashboardShell>
  )
}
