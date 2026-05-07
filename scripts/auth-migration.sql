-- ============================================================
-- ERA CUE — Auth + Org Membership Migration
-- Run this in the Supabase SQL editor BEFORE the app starts
-- using the new auth pages. Idempotent — safe to re-run.
--
-- This migration:
--   1. Adds new columns to the existing `orgs` table (the demo
--      schema only has id/name/tier/created_at).
--   2. Creates org_members, invitations, onboarding tables.
--   3. Wires Row Level Security so authenticated users only see
--      data for orgs they belong to via org_members.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------
-- Orgs — extend the existing demo table with the new columns the
-- onboarding flow writes into. ADD COLUMN IF NOT EXISTS so a
-- repeat run is a no-op.
-- ----------------------------------------------------------------
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS firm_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS regulatory_framework TEXT[] DEFAULT '{}';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'trial';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orgs_slug_key'
  ) THEN
    ALTER TABLE orgs ADD CONSTRAINT orgs_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Org members (users + roles). Links Supabase Auth users to orgs.
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'speaker',
  title TEXT,
  display_name TEXT,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(org_id);

-- Invitations (pending acceptance). Token is the URL slug for /auth/invite/[token].
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'speaker',
  title TEXT,
  display_name TEXT,
  invited_by UUID REFERENCES auth.users(id),
  token UUID DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);

-- Onboarding progress tracking. step_completed is an array of:
--   'firm_context', 'rules', 'speakers', 'test_run'
CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES orgs(id) ON DELETE CASCADE,
  step_completed TEXT[] DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ----------------------------------------------------------------
-- Row Level Security — org isolation via org_members.
-- ----------------------------------------------------------------
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_see_own_org" ON orgs;
CREATE POLICY "members_see_own_org" ON orgs FOR SELECT
  USING (id IN (
    SELECT org_id FROM org_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "see_own_membership" ON org_members;
CREATE POLICY "see_own_membership" ON org_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "principals_see_invitations" ON invitations;
CREATE POLICY "principals_see_invitations" ON invitations FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid() AND role = 'principal'
  ));

-- Org isolation for the existing data tables. The demo's "service_role_all_*"
-- policies are NOT dropped — service-role access (used by getSupabaseAdmin())
-- still bypasses RLS for server actions.
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON drafts;
CREATE POLICY "org_isolation" ON drafts FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON rules;
CREATE POLICY "org_isolation" ON rules FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation" ON actions;
CREATE POLICY "org_isolation" ON actions FOR ALL
  USING (draft_id IN (
    SELECT id FROM drafts WHERE org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  ));

-- END MIGRATION
