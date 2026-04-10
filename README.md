# HireOS

Agentic AI technical interview platform built with Next.js, Supabase, and TypeScript.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Tailwind CSS v4
- **UI**: Radix UI primitives + custom components
- **Charts**: Recharts
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project (or local via `supabase start`)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file and fill in Supabase credentials
cp .env.local.example .env.local

# Run the database migration
# (paste supabase/migrations/001_initial_schema.sql into Supabase SQL Editor)

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, callback
│   ├── (public)/           # Landing page
│   ├── api/                # API route handlers
│   ├── dashboard/          # Authenticated dashboard
│   └── portal/             # Candidate assessment portal
├── components/
│   ├── dashboard/          # Dashboard-specific components
│   ├── landing/            # Landing page sections
│   ├── layout/             # Shell, navbar, sidebar, footer
│   └── ui/                 # Reusable UI primitives
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, Supabase clients, validations
└── types/                  # TypeScript type definitions
```

## API Routes

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/jobs` | List/create jobs |
| GET/PATCH/DELETE | `/api/jobs/[jobId]` | Single job operations |
| GET/POST | `/api/candidates` | List/create candidates |
| POST | `/api/candidates/bulk` | CSV bulk import |
| POST | `/api/invite` | Generate invite link |
| GET | `/api/portal/[token]` | Validate portal token |
| GET | `/api/health` | Health check |

---

## Part 2 — Interview Engine

Part 2 adds the full AI-powered interview engine: real-time voice interviews, live coding, system design whiteboard, online assessments, and comprehensive evaluation.

### Additional Services

| Service | Port | Description |
|---|---|---|
| **Interview WS Server** | 3001 | Fastify + WebSocket server for real-time interview sessions |
| **Redis** | 6379 | Event streaming between agents, session state, caching |
| **Code Sandbox** | 4000 | Isolated code execution via gVisor (Docker) |
| **Cloudflare Worker** | — | Durable Objects for session persistence, R2 for recordings |

### Running All Services

```bash
# Start Next.js + Interview WS server together
npm run dev:all

# Or separately:
npm run dev          # Next.js (port 3000)
npm run dev:server   # WS server (port 3001)
```

### Docker Setup (Sandbox + Redis)

```bash
# Start Redis and code sandbox
docker-compose up -d redis sandbox

# Start everything (including interview-ws)
docker-compose up -d
```

The sandbox runs candidate code inside gVisor with: no network access, 512MB memory limit, 10s per-test timeout, and dropped capabilities.

### Cloudflare Worker Deployment

```bash
npm run deploy:worker
```

Required Cloudflare resources: Durable Object (`INTERVIEW_SESSION`), R2 Bucket (`hireos-recordings`), AI Binding.

### Part 2 Environment Variables

Add these to `.env.local`:

| Variable | Description |
|---|---|
| `DEEPGRAM_API_KEY` | Speech-to-text (Deepgram Nova-2) |
| `ELEVENLABS_API_KEY` | Text-to-speech (ElevenLabs Turbo v2) |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice ID |
| `AZURE_SPEECH_KEY` | Azure TTS fallback |
| `AZURE_SPEECH_REGION` | Azure region |
| `ANTHROPIC_API_KEY` | Anthropic Claude (evaluation + fallback) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `CLOUDFLARE_AI_GATEWAY_TOKEN` | Cloudflare Workers AI token |
| `CLOUDFLARE_WORKER_URL` | Deployed worker URL |
| `REDIS_URL` | Redis connection string |
| `SANDBOX_URL` | Code sandbox URL (default: `http://localhost:4000`) |

### Database Migration

```bash
npm run db:migrate:002
# Or paste supabase/migrations/002_part2_interview_engine.sql in Supabase SQL Editor
```

### Part 2 API Routes

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/portal/[token]/start-round` | Start an interview round |
| GET/POST | `/api/portal/[token]/checkpoint` | Session recovery checkpoints |
| POST | `/api/portal/[token]/system-check-result` | Store system check results |
| GET | `/api/portal/[token]/oa-problems` | Get OA problem set |
| POST | `/api/portal/[token]/submit-oa` | Submit OA answers |
| POST | `/api/portal/[token]/submit-code` | Execute code (SSE streaming) |
| POST | `/api/portal/recording/presign` | Get R2 upload URL |
| POST | `/api/portal/recording/finalize` | Complete multipart upload |
| GET | `/api/dashboard/candidates/[id]/report` | Full candidate report |
| GET/POST/DELETE | `/api/dashboard/jobs/[jobId]/oa-problems` | OA question bank |

### Testing

```bash
npm run test:server          # Server integration tests
# See docs/E2E_TEST_CHECKLIST.md for manual E2E scenarios
```

## License

Private — All rights reserved.
