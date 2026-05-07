-- ============================================================
-- ERA CUE — Publish Token Migration
-- Adds three columns to `drafts` so the reviewer action can issue
-- a clearance credential when a draft is approved/overridden.
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS publish_token TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS publish_token_expires_at TIMESTAMPTZ;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS draft_hash_at_approval TEXT;

-- Index the token so a downstream "verify token → fetch draft" lookup
-- doesn't have to scan the table.
CREATE INDEX IF NOT EXISTS idx_drafts_publish_token ON drafts(publish_token)
  WHERE publish_token IS NOT NULL;

-- END MIGRATION
