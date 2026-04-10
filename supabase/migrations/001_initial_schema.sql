-- ============================================================
-- HireOS — Initial Database Schema Migration
-- Created: 2026-04-10
-- Description: Complete schema for Part 1 — Landing, Dashboard,
--              Candidate Portal with link shareability
-- ============================================================

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE job_status AS ENUM ('draft', 'active', 'paused', 'closed');
CREATE TYPE candidate_status AS ENUM ('invited', 'in_progress', 'completed', 'rejected', 'hired', 'on_hold');
CREATE TYPE round_type AS ENUM ('online_assessment', 'telephonic_screen', 'live_coding', 'system_design', 'behavioral', 'technical_deep_dive');
CREATE TYPE invite_status AS ENUM ('pending', 'opened', 'started', 'expired');

-- ─── FUNCTIONS ──────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── TABLES ─────────────────────────────────────────────────

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles (linked to Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  full_name TEXT,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'hr' CHECK (role IN ('hr', 'admin', 'hiring_manager')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  job_type TEXT DEFAULT 'full_time',
  seniority_level TEXT,
  description TEXT,
  required_skills TEXT[] DEFAULT '{}',
  nice_to_have_skills TEXT[] DEFAULT '{}',
  status job_status DEFAULT 'draft',
  target_headcount INTEGER DEFAULT 1,
  deadline DATE,
  pipeline_config JSONB DEFAULT '{}',
  scoring_rubric JSONB DEFAULT '{}',
  auto_advance_rules JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Candidates
CREATE TABLE candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  job_id UUID NOT NULL REFERENCES jobs(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  resume_url TEXT,
  parsed_resume JSONB DEFAULT '{}',
  source TEXT DEFAULT 'manual',
  status candidate_status DEFAULT 'invited',
  current_round INTEGER DEFAULT 0,
  overall_score NUMERIC(5,2),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, email)
);

-- Candidate Invites
CREATE TABLE candidate_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status invite_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  opened_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Round Results
CREATE TABLE round_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id),
  round_type round_type NOT NULL,
  round_number INTEGER NOT NULL,
  score NUMERIC(5,2),
  max_score NUMERIC(5,2) DEFAULT 100,
  recommendation TEXT CHECK (recommendation IN ('advance', 'hold', 'reject')),
  skill_scores JSONB DEFAULT '{}',
  ai_summary TEXT,
  integrity_score NUMERIC(5,2),
  flag_count INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── INDEXES ────────────────────────────────────────────────

CREATE INDEX idx_jobs_org ON jobs(organization_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_candidates_job ON candidates(job_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_invites_token ON candidate_invites(token);
CREATE INDEX idx_invites_candidate ON candidate_invites(candidate_id);
CREATE INDEX idx_round_results_candidate ON round_results(candidate_id);
CREATE INDEX idx_round_results_job ON round_results(job_id);

-- ─── TRIGGERS ───────────────────────────────────────────────

-- Auto-update updated_at on organizations
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on jobs
CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on candidates
CREATE TRIGGER set_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- After insert on candidate_invites, update candidate status to 'invited'
CREATE OR REPLACE FUNCTION set_candidate_invited()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE candidates SET status = 'invited' WHERE id = NEW.candidate_id AND status = 'invited';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_candidate_invited
  AFTER INSERT ON candidate_invites
  FOR EACH ROW EXECUTE FUNCTION set_candidate_invited();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_results ENABLE ROW LEVEL SECURITY;

-- Organizations: users can only access their own org
CREATE POLICY "Users can view own organization"
  ON organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update own organization"
  ON organizations FOR UPDATE
  USING (id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Profiles: users can read org profiles, update own
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Jobs: HR can CRUD jobs in their org
CREATE POLICY "HR can view org jobs"
  ON jobs FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can create org jobs"
  ON jobs FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can update org jobs"
  ON jobs FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can delete org jobs"
  ON jobs FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Candidates: HR can CRUD candidates in their org
CREATE POLICY "HR can view org candidates"
  ON candidates FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can create org candidates"
  ON candidates FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can update org candidates"
  ON candidates FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "HR can delete org candidates"
  ON candidates FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- Candidate Invites: HR can create/read in their org
CREATE POLICY "HR can view org invites"
  ON candidate_invites FOR SELECT
  USING (job_id IN (SELECT id FROM jobs WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "HR can create org invites"
  ON candidate_invites FOR INSERT
  WITH CHECK (job_id IN (SELECT id FROM jobs WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "HR can update org invites"
  ON candidate_invites FOR UPDATE
  USING (job_id IN (SELECT id FROM jobs WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));

-- Round Results: HR can read all in their org; AI writes via service role
CREATE POLICY "HR can view org round results"
  ON round_results FOR SELECT
  USING (job_id IN (SELECT id FROM jobs WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())));
