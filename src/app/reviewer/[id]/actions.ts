"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

type DecisionInput = {
  draftId: string;
  decision: "approve" | "reject" | "override" | "confirm_block";
  reason: string | null;
};

type DecisionResult = { success: true; error?: undefined } | { success?: undefined; error: string };

export async function reviewerDecisionAction(input: DecisionInput): Promise<DecisionResult> {
  const sb = getSupabaseAdmin();

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

  // Write reviewer_decided action
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
