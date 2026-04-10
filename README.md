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

## License

Private — All rights reserved.
