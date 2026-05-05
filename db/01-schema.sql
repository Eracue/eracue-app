-- ========================
-- ERA CUE Schema v0
-- Deployed to Supabase 2026-05-04
-- See docs/schema-v0.md for design rationale
-- ========================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- TABLE 1: orgs
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('solo', 'team', 'finra')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_orgs" ON orgs FOR ALL USING (true) WITH CHECK (true);

-- TABLE 2: users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('speaker', 'reviewer', 'principal')),
  title text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_org ON users(org_id);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_users" ON users FOR ALL USING (true) WITH CHECK (true);

-- TABLE 3: campaigns
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_campaigns_org ON campaigns(org_id);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_campaigns" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- TABLE 4: rules (bi-temporal)
CREATE TABLE rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('block', 'escalate', 'review', 'guide')),
  name text NOT NULL,
  description text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  effective_from timestamptz NOT NULL,
  effective_to timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid REFERENCES rules(id)
);
CREATE INDEX idx_rules_org ON rules(org_id);
CREATE INDEX idx_rules_effective ON rules(effective_from, effective_to);
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_rules" ON rules FOR ALL USING (true) WITH CHECK (true);

-- TABLE 5: drafts
CREATE TABLE drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid REFERENCES campaigns(id),
  channel text NOT NULL CHECK (channel IN ('linkedin', 'twitter', 'press_release', 'blog', 'interview', 'email', 'other')),
  draft_text text NOT NULL,
  source_origin text NOT NULL CHECK (source_origin IN ('human', 'ai_assisted', 'ai_generated')),
  ai_model_used text,
  prompt_hash text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'escalated', 'blocked', 'overridden'))
);
CREATE INDEX idx_drafts_org ON drafts(org_id);
CREATE INDEX idx_drafts_speaker ON drafts(speaker_id);
CREATE INDEX idx_drafts_campaign ON drafts(campaign_id);
CREATE INDEX idx_drafts_status ON drafts(status);
ALTER TABLE drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_drafts" ON drafts FOR ALL USING (true) WITH CHECK (true);

-- TABLE 6: actions (THE IMMUTABLE RECORD)
CREATE TABLE actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  draft_id uuid NOT NULL REFERENCES drafts(id),
  action_type text NOT NULL CHECK (action_type IN ('submitted', 'check_ran', 'verdict_issued', 'suggested_fix', 'reviewer_decided', 'block_overridden')),
  actor_id uuid REFERENCES users(id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('user', 'system', 'ai_check')),
  payload jsonb NOT NULL,
  rules_active uuid[] NOT NULL DEFAULT '{}',
  model_version text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  row_hash text NOT NULL DEFAULT ''
);
CREATE INDEX idx_actions_org ON actions(org_id);
CREATE INDEX idx_actions_draft ON actions(draft_id);
CREATE INDEX idx_actions_type ON actions(action_type);
CREATE INDEX idx_actions_occurred ON actions(occurred_at);
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_actions" ON actions FOR ALL USING (true) WITH CHECK (true);

-- APPEND-ONLY TRIGGERS (the moat)
CREATE OR REPLACE FUNCTION actions_compute_hash()
RETURNS trigger AS $func$
BEGIN
  NEW.row_hash := encode(
    digest(
      NEW.id::text || NEW.draft_id::text || NEW.action_type || NEW.payload::text || NEW.occurred_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actions_compute_hash
  BEFORE INSERT ON actions
  FOR EACH ROW
  EXECUTE FUNCTION actions_compute_hash();

CREATE OR REPLACE FUNCTION actions_reject_update()
RETURNS trigger AS $func$
BEGIN
  RAISE EXCEPTION 'actions table is append-only — UPDATE is not permitted';
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actions_reject_update
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION actions_reject_update();

CREATE OR REPLACE FUNCTION actions_reject_delete()
RETURNS trigger AS $func$
BEGIN
  RAISE EXCEPTION 'actions table is append-only — DELETE is not permitted';
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actions_reject_delete
  BEFORE DELETE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION actions_reject_delete();

-- END SCHEMA
