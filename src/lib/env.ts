function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value ?? ''
}

export const env = {
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}
