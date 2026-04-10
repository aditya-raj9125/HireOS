function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value ?? ''
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export const env = {
  // ─── Part 1 ────────────────────────────────────
  supabaseUrl: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',

  // ─── Part 2: Cloudflare ────────────────────────
  cloudflareAccountId: requireEnv('CLOUDFLARE_ACCOUNT_ID'),
  cloudflareAiToken: requireEnv('CLOUDFLARE_AI_TOKEN'),
  cloudflareAiGatewayUrl: optionalEnv('CLOUDFLARE_AI_GATEWAY_URL'),
  cloudflareR2AccessKeyId: requireEnv('CLOUDFLARE_R2_ACCESS_KEY_ID'),
  cloudflareR2SecretAccessKey: requireEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY'),
  cloudflareR2BucketName: requireEnv('CLOUDFLARE_R2_BUCKET_NAME'),
  cloudflareR2Endpoint: requireEnv('CLOUDFLARE_R2_ENDPOINT'),
  cloudflareWorkersUrl: requireEnv('CLOUDFLARE_WORKERS_URL'),

  // ─── Part 2: Speech Services ───────────────────
  deepgramApiKey: requireEnv('DEEPGRAM_API_KEY'),
  elevenlabsApiKey: requireEnv('ELEVENLABS_API_KEY'),
  elevenlabsVoiceId: requireEnv('ELEVENLABS_VOICE_ID'),
  azureTtsKey: optionalEnv('AZURE_TTS_KEY'),
  azureTtsRegion: optionalEnv('AZURE_TTS_REGION'),

  // ─── Part 2: Infrastructure ────────────────────
  interviewWsUrl: optionalEnv('INTERVIEW_WS_URL', 'ws://localhost:3001'),
  sandboxServiceUrl: optionalEnv('SANDBOX_SERVICE_URL', 'http://localhost:4000'),
  redisUrl: requireEnv('REDIS_URL'),

  // ─── Part 2: LLM Fallback ─────────────────────
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
}
