"use server";

import { createHash } from "crypto";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

export type DecisionReason = {
  basis: string;
  verdict_assessment: string | null;
  note: string;
};

// Hours until the publish token expires after issuance. 72h matches the
// typical fortnightly comms cadence — a draft approved Friday is still
// valid through Monday morning.
const PUBLISH_TOKEN_TTL_HOURS = 72;

/**
 * Mint a clearance credential for an approved draft.
 *
 * Token shape:
 *   eracue_pub_<12 hex chars>      — deterministic from draft + reviewer
 *
 * The token is short on purpose — long enough to be globally unique within
 * a sane org-month window, short enough to read aloud. The companion
 * `draft_hash` (full SHA-256 of the draft body) is what the publishing
 * tool actually verifies against; the token is just the lookup key.
 */
function generatePublishToken(
  draftId: string,
  draftText: string,
  reviewerId: string,
  approvedAt: string,
): { token: string; draft_hash: string; expires_at: string } {
  const token =
    "eracue_pub_" +
    createHash("sha256")
      .update(draftId + reviewerId + approvedAt)
      .digest("hex")
      .slice(0, 12);
  const draft_hash = createHash("sha256").update(draftText).digest("hex");
  const expires_at = new Date(
    Date.now() + PUBLISH_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  return { token, draft_hash, expires_at };
}

type DecisionInput = {
  draftId: string;
  decision: "approve" | "reject" | "override" | "confirm_block";
  reason: DecisionReason;
  // Seconds the reviewer spent on the page before clicking decide.
  // Stored on the reviewer_decided payload so the examiner record can
  // surface 'Review duration: 4m 23s' and flag suspiciously fast reviews.
  reviewDurationSeconds?: number;
};

type DecisionResult = { success: true; error?: undefined } | { success?: undefined; error: string };

export async function reviewerDecisionAction(input: DecisionInput): Promise<DecisionResult> {
  const sb = getSupabaseAdmin();

  // Validate the structured reason server-side too — basis is always required.
  if (!input.reason || !input.reason.basis) {
    return { error: "Basis for decision is required." };
  }

  // Find the principal
  const { data: principal, error: pErr } = await sb
    .from("users")
    .select("id")
    .eq("org_id", DEMO_ORG_ID)
    .eq("role", "principal")
    .single();
  if (pErr || !principal) return { error: "No principal found in this org" };

  // Determine new status
  let newStatus: string;
  if (input.decision === "override") newStatus = "overridden";
  else if (input.decision === "approve") newStatus = "approved";
  else if (input.decision === "reject") newStatus = "blocked";
  else if (input.decision === "confirm_block") newStatus = "blocked";
  else return { error: "Invalid decision" };

  // Mint a publish token on approve/override. The token is deterministic
  // from (draftId, reviewerId, approvedAt) so re-running the action with
  // the same inputs (e.g. a duplicate click) produces the same token —
  // but the approvedAt timestamp differs per-call, so two distinct
  // approvals always yield distinct tokens. The companion draft_hash
  // is what the downstream publish tool verifies against; if the body
  // is edited after approval, the hash mismatches and the token is
  // effectively void even before its expires_at.
  const issuesToken =
    input.decision === "approve" || input.decision === "override";
  let tokenFields: {
    publish_token: string;
    publish_token_expires_at: string;
    draft_hash_at_approval: string;
  } | null = null;
  if (issuesToken) {
    const { data: draftRow } = await sb
      .from("drafts")
      .select("draft_text")
      .eq("id", input.draftId)
      .maybeSingle();
    const draftText = (draftRow?.draft_text as string | undefined) ?? null;
    if (draftText) {
      const { token, draft_hash, expires_at } = generatePublishToken(
        input.draftId,
        draftText,
        // Reviewer identity — production deployments will resolve the
        // logged-in principal's name. The demo principal is fixed.
        "Sarah Chen, GC",
        new Date().toISOString(),
      );
      tokenFields = {
        publish_token: token,
        publish_token_expires_at: expires_at,
        draft_hash_at_approval: draft_hash,
      };
    }
  }

  // Write reviewer_decided action — reason is now a structured object
  // ({ basis, verdict_assessment, note }) rather than a freeform string.
  // Token fields ride along on the payload so the audit trail records
  // exactly which token was issued and when, even if the columns on
  // `drafts` are later overwritten (e.g. a re-issue).
  const { error: rdErr } = await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: input.draftId,
    action_type: "reviewer_decided",
    actor_id: principal.id,
    actor_kind: "user",
    payload: {
      decision: input.decision,
      reason: input.reason,
      new_status: newStatus,
      ...(typeof input.reviewDurationSeconds === "number"
        ? { review_duration_seconds: input.reviewDurationSeconds }
        : {}),
      ...(tokenFields
        ? {
            publish_token: tokenFields.publish_token,
            draft_hash: tokenFields.draft_hash_at_approval,
            token_expires_at: tokenFields.publish_token_expires_at,
          }
        : {}),
    },
  });
  if (rdErr) return { error: "Failed to record decision: " + rdErr.message };

  // If overriding a BLOCK, also write block_overridden action
  if (input.decision === "override") {
    await sb.from("actions").insert({
      org_id: DEMO_ORG_ID,
      draft_id: input.draftId,
      action_type: "block_overridden",
      actor_id: principal.id,
      actor_kind: "user",
      payload: {
        reason: input.reason,
      },
    });
  }

  // Update draft status (and token fields if we minted one). The token
  // fields are spread inside a try/catch so a not-yet-migrated DB —
  // missing publish_token columns — only loses the convenience of
  // surfacing the token on the drafts row; the audit-trail copy on
  // payload still carries it intact.
  if (tokenFields) {
    try {
      const { error: tokenErr } = await sb
        .from("drafts")
        .update({ status: newStatus, ...tokenFields })
        .eq("id", input.draftId);
      if (tokenErr) {
        // Most likely cause: scripts/publish-token-migration.sql hasn't
        // been run yet (PostgREST 42703 — column not found). Fall back
        // to a status-only update so the decision still lands.
        const { error: uErr } = await sb
          .from("drafts")
          .update({ status: newStatus })
          .eq("id", input.draftId);
        if (uErr) return { error: "Failed to update draft status: " + uErr.message };
      }
    } catch {
      const { error: uErr } = await sb
        .from("drafts")
        .update({ status: newStatus })
        .eq("id", input.draftId);
      if (uErr) return { error: "Failed to update draft status: " + uErr.message };
    }
  } else {
    const { error: uErr } = await sb
      .from("drafts")
      .update({ status: newStatus })
      .eq("id", input.draftId);
    if (uErr) return { error: "Failed to update draft status: " + uErr.message };
  }

  return { success: true };
}
