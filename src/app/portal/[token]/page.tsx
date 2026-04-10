import type { Metadata } from 'next'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { PortalClient } from './portal-client'

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const supabase = createServiceRoleClient()

  const { data: invite } = await supabase
    .from('candidate_invites')
    .select('job_id')
    .eq('token', token)
    .single()

  if (!invite) {
    return { title: 'Invalid Invite — HireOS' }
  }

  const { data: job } = await supabase
    .from('jobs')
    .select('title, organization_id')
    .eq('id', invite.job_id)
    .single()

  let orgName: string | null = null
  if (job?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', job.organization_id)
      .single()
    orgName = org?.name ?? null
  }

  return {
    title: `${job?.title ?? 'Assessment'} — ${orgName ?? 'HireOS'}`,
    description: `Complete your technical assessment for the ${job?.title} role.`,
    robots: { index: false, follow: false },
  }
}

export default async function PortalPage({ params }: Props) {
  const { token } = await params
  return <PortalClient token={token} />
}
