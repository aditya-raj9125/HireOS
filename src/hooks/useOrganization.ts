import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import type { Organization, Profile } from '@/types'

export function useOrganization() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData as Profile)

        if (profileData.organization_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single()

          if (orgData) setOrganization(orgData as Organization)
        }
      }

      setLoading(false)
    }

    load()
  }, [])

  return { organization, profile, loading }
}
