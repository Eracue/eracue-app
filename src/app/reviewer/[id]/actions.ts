"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

export type DecisionReason = {
  basis: string;
  verdict_assessment: string | null;
  note: string;
};

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

  // Write reviewer_decided action — reason is now a structured object
  // ({ basis, verdict_assessment, note }) rather than a freeform string.
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

  // Update draft status
  const { error: uErr } = await sb.from("drafts").update({ status: newStatus }).eq("id", input.draftId);
  if (uErr) return { error: "Failed to update draft status: " + uErr.message };

  return { success: true };
}
