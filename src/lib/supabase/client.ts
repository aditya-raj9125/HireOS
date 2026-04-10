import { createBrowserClient } from '@supabase/ssr'

// TODO: Replace with generated Database type from Supabase CLI
let client: ReturnType<typeof createBrowserClient> | null = null

export function createBrowserSupabaseClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
