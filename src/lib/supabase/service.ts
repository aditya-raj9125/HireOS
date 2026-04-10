// NEVER import this in client components
// This client bypasses RLS and should only be used in API routes
// for privileged operations (e.g., reading invite tokens)

import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
