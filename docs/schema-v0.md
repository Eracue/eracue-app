# ERA CUE Schema v0 — Design Document

Status: design, not deployed. Tomorrow morning's first task: deploy this as SQL via Supabase SQL Editor.

## Design principles

1. Multi-tenant from day 1. Every business table has org_id.
2. Append-only for the actions table. Database trigger rejects UPDATE and DELETE. SHA-256 hash on insert. This is the immutable record.
3. Bi-temporal rules. Every rule has effective_from and effective_to. When a check runs, it queries rules active at submission_time, not now(). Historical records show what policy was actually in force at submission.
4. EU AI Act + FINRA fields populated from row 1. source_origin, prompt_hash, model_version exist on every relevant row.
5. RLS on every table, permissive in dev, tighten before any external user.
6. UUIDs for all primary keys. Generated server-side via gen_random_uuid().

---

## Table 1: orgs

The customer's organization. One row per customer.

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| name | text NOT NULL | "Acme Corp" |
| tier | text NOT NULL CHECK (tier IN ('solo','team','finra')) | pricing tier |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**Demo seed:** 1 row. tier='team'. name='ERA CUE Demo Co'.

---

## Table 2: users

Speakers and reviewers within an org. Not Supabase auth users — those come later. For demo, this is a simple identity table.

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE | |
| name | text NOT NULL | "Sarah Chen" |
| role | text NOT NULL CHECK (role IN ('speaker','reviewer','principal')) | |
| title | text | "CEO", "VP Sales", "GC" |
| email | text | optional for demo |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**Demo seed:** 5 rows. 1 principal (GC), 4 speakers (CEO, CMO, VP Sales, VP Comms).

---

## Table 3: campaigns

A coordinated comms effort spanning multiple speakers and drafts. The campaign view in the dashboard groups drafts by this.

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE | |
| name | text NOT NULL | "Series B Announce" |
| description | text | |
| starts_at | timestamptz | nullable |
| ends_at | timestamptz | nullable |
| created_at | timestamptz NOT NULL DEFAULT now() | |

**Demo seed:** 2 rows. "Series B Announce" and "Q3 Product Launch".

---

## Table 4: rules

Principal-approved restrictions. Bi-temporal — every rule has effective dates.

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE | |
| rule_type | text NOT NULL CHECK (rule_type IN ('block','escalate','review','guide')) | maps to verdict outcomes |
| name | text NOT NULL | "Series B Quiet Period" |
| description | text NOT NULL | "No hiring or growth language during quiet period" |
| keywords | text[] | terms that trigger the rule, e.g. ['hiring','expanding','growth'] |
| effective_from | timestamptz NOT NULL | when rule becomes active |
| effective_to | timestamptz | nullable = no end date |
| created_by | uuid REFERENCES users(id) | which principal approved |
| created_at | timestamptz NOT NULL DEFAULT now() | |
| superseded_by | uuid REFERENCES rules(id) | if amended, points to the new version |

**Demo seed:** 6 rows.
- 1 BLOCK: Series B Quiet Period (active May 1 - May 31, keywords: hiring, expanding, growth, raising)
- 1 BLOCK: Embargo on Q3 Product Launch (active until launch_date)
- 1 ESCALATE: Sales claims about enterprise deals
- 1 ESCALATE: Competitor mentions
- 1 REVIEW: Pricing claims
- 1 GUIDE: Tone for press releases (formal, no contractions)

---

## Table 5: drafts

The thing a speaker submits. One row per draft.

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| org_id | uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE | |
| speaker_id | uuid NOT NULL REFERENCES users(id) | who's about to publish |
| campaign_id | uuid REFERENCES campaigns(id) | optional |
| channel | text NOT NULL CHECK (channel IN ('linkedin','twitter','press_release','blog','interview','email','other')) | |
| draft_text | text NOT NULL | the content |
| source_origin | text NOT NULL CHECK (source_origin IN ('human','ai_assisted','ai_generated')) | EU AI Act Article 50 |
| ai_model_used | text | "claude-sonnet-4-6" if ai_assisted/ai_generated, else null |
| prompt_hash | text | SHA-256 of the prompt if AI was used; never the prompt itself |
| submitted_at | timestamptz NOT NULL DEFAULT now() | server-side, immutable |
| status | text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','escalated','blocked','overridden')) | |

**Demo seed:** 30 rows. Mix of speakers, channels, source_origin values, both campaigns plus some without. Various statuses.

---

## Table 6: actions (the immutable record)

Append-only. Every system or human action writes one row here. **This is the audit log. The moat.**

| Column | Type | Notes |
|---|---|---|
| id | uuid PRIMARY KEY DEFAULT gen_random_uuid() | |
| org_id | uuid NOT NULL REFERENCES orgs(id) | |
| draft_id | uuid NOT NULL REFERENCES drafts(id) | what the action is about |
| action_type | text NOT NULL CHECK (action_type IN ('submitted','check_ran','verdict_issued','suggested_fix','reviewer_decided','block_overridden')) | |
| actor_id | uuid REFERENCES users(id) | who acted; null if system |
| actor_kind | text NOT NULL CHECK (actor_kind IN ('user','system','ai_check')) | |
| payload | jsonb NOT NULL | type-specific data: which check ran, what verdict, what reviewer decided, what reason for override |
| rules_active | uuid[] | snapshot of rule IDs active at this moment (bi-temporal) |
| model_version | text | "claude-sonnet-4-6" if ai_check fired |
| occurred_at | timestamptz NOT NULL DEFAULT now() | immutable; cannot be backdated |
| row_hash | text NOT NULL | SHA-256 of (id || draft_id || action_type || payload || occurred_at). Set by trigger. Tamper evidence. |

**Database constraints (CRITICAL — these enforce the moat):**

- BEFORE INSERT trigger: compute row_hash from row contents.
- BEFORE UPDATE trigger: RAISE EXCEPTION 'actions table is append-only'.
- BEFORE DELETE trigger: RAISE EXCEPTION 'actions table is append-only'.
- These triggers cannot be bypassed by application code. The database itself refuses mutations.

**Demo seed:** ~120 rows (4 per draft on average — submission, checks, verdict, decision).

---

## RLS policies (permissive for dev, tighten later)

Every table gets RLS enabled. For now, policies are: anyone with the secret key (server-side) can do anything. The publishable key (browser-side) gets read-only on certain views — we add those when wiring the UI.

For each table (orgs, users, campaigns, rules, drafts, actions):
- ENABLE ROW LEVEL SECURITY
- CREATE POLICY "service_role_all" FOR ALL USING (true) WITH CHECK (true)

This is intentionally permissive. Tighten before launch.

---

## What this schema does NOT have yet (Phase 1+)

- corpus_signals table (LinkedIn ingestion, podcast transcripts) — Tuesday afternoon if time
- governance_health_score table (computed metric) — post-demo
- gap_monitor_events (un-governed posts) — post-demo
- amendments table (rule version history beyond superseded_by) — post-demo
- review_chains (escalation routing config) — post-demo
- agent_submissions (MCP / agent provenance, beyond what's in drafts) — post-demo

These are real Phase 1 work but not blocking the demo. The schema above supports the entire demo workflow.

---

## SQL execution plan for tomorrow morning

1. Open Supabase SQL Editor.
2. Paste the deployment SQL (we'll generate it from this design).
3. Run it.
4. Verify by SELECT against each table — should return 0 rows but no errors.
5. Run the seed SQL.
6. Verify counts: 1 org, 5 users, 2 campaigns, 6 rules, 30 drafts, ~120 actions.
7. Try UPDATE actions SET ... — must fail with "actions table is append-only".

If the trigger doesn't reject the UPDATE, the moat is broken. We don't ship until that works.

---

End of v0 design.