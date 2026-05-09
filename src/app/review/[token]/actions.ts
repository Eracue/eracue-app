"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

// Public reviewer flow.
//
// Receives a `token` (today: a draft id; in production an opaque
// per-submission token stored on `drafts`) plus a three-state decision
// — APPROVED / CHANGES REQUESTED / ESCALATED — and writes a
// `reviewer_decided` action plus a `drafts.status` update.
//
// Auth: the route is in PUBLIC_PATHS in middleware.ts. The action runs
// with the service-role admin client (bypasses RLS), so the public link
// is the access credential — anyone with the token can decide on the
// draft. That mirrors a typical magic-link review flow.

export type PublicDecision = "approved" | "changes_requested" | "escalated";

type DecisionInput = {
  // Today: equals draft.id. Production deployments will look up an
  // opaque token column on `drafts` and resolve it to a draft id.
  token: string;
  decision: PublicDecision;
  // Optional free-text rationale, capped at 500 chars on the client.
  // Server enforces the same cap as a backstop.
  basis: string;
  // Seconds the reviewer spent on the page before clicking decide.
  // Stored on the action payload so the examiner record can surface
  // a review-duration line.
  reviewDurationSeconds: number;
};

type DecisionResult = { ok: true } | { ok: false; error: string };

const STATUS_BY_DECISION: Record<PublicDecision, string> = {
  approved: "approved",
  // Changes requested = the speaker needs to revise. We park the draft
  // in `blocked` so it shows up alongside other action-required drafts
  // on the dashboard. The decision string on the action payload is
  // what carries the reviewer's actual intent.
  changes_requested: "blocked",
  escalated: "escalated",
};

export async function publicReviewerDecisionAction(
  input: DecisionInput,
): Promise<DecisionResult> {
  const sb = getSupabaseAdmin();

  if (!input.token) return { ok: false, error: "Missing review token." };
  if (!input.decision) return { ok: false, error: "Decision is required." };

  const basis = (input.basis ?? "").slice(0, 500);

  // Resolve token → draft. For now token === draft.id; switch to a
  // dedicated token column when the schema lands.
  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, org_id, submitted_at")
    .eq("id", input.token)
    .maybeSingle();
  if (dErr) return { ok: false, error: "Lookup failed: " + dErr.message };
  if (!draft) return { ok: false, error: "Review link not found or expired." };

  // Find a principal in the draft's org so the action has a valid
  // actor_id. Falls back to DEMO_ORG_ID for demo seeds.
  const orgId = (draft.org_id as string | undefined) ?? DEMO_ORG_ID;
  const { data: principal } = await sb
    .from("users")
    .select("id")
    .eq("org_id", orgId)
    .eq("role", "principal")
    .maybeSingle();

  const newStatus = STATUS_BY_DECISION[input.decision];

  const { error: actionErr } = await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "reviewer_decided",
    actor_id: principal?.id ?? null,
    actor_kind: "user",
    payload: {
      decision: input.decision,
      reason: { basis },
      new_status: newStatus,
      review_duration_seconds: input.reviewDurationSeconds,
      via: "public_review_link",
    },
  });
  if (actionErr) {
    return { ok: false, error: "Failed to record decision: " + actionErr.message };
  }

  const { error: uErr } = await sb
    .from("drafts")
    .update({ status: newStatus })
    .eq("id", draft.id);
  if (uErr) {
    // Action record landed; surface the status-update error so the
    // reviewer knows their decision is captured but the draft state
    // didn't move. Production deployments will retry.
    return { ok: false, error: "Decision recorded, status update failed: " + uErr.message };
  }

  return { ok: true };
}
