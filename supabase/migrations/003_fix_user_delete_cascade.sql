-- ============================================================
-- HireOS Migration 003 — Fix user deletion cascade
-- Problem: Deleting an auth user cascades to profiles, but
--          jobs.created_by references profiles(id) with no
--          ON DELETE rule (defaults to RESTRICT), blocking deletion.
-- Fix: Make created_by nullable + ON DELETE SET NULL
-- ============================================================

-- 1. Drop the old NOT NULL + RESTRICT foreign key
ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_created_by_fkey;

-- 2. Allow NULL (user may be deleted but job stays)
ALTER TABLE jobs
  ALTER COLUMN created_by DROP NOT NULL;

-- 3. Re-add the FK with SET NULL on delete
ALTER TABLE jobs
  ADD CONSTRAINT jobs_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
