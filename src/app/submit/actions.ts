"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { runChecks, verdictToStatus, getSupabaseAdmin, buildChecksArray } from "@/lib/checks";
import type { CheckEntry, RuleMatch, Verdict } from "@/lib/checks";

type SubmitInput = {
  speakerId: string;
  channel: string;
  sourceOrigin: string;
  campaignId: string | null;
  draftText: string;
};

export type SubmitSuccess = {
  draftId: string;
  verdict: Verdict;
  primaryMatch: RuleMatch | null;
  checks: CheckEntry[];
  error?: undefined;
};
type SubmitResult = SubmitSuccess | { draftId?: undefined; error: string };

export async function submitDraftAction(input: SubmitInput): Promise<SubmitResult> {
  const sb = getSupabaseAdmin();

  // 1. Insert draft
  const { data: draft, error: draftErr } = await sb.from("drafts").insert({
    org_id: DEMO_ORG_ID,
    speaker_id: input.speakerId,
    campaign_id: input.campaignId,
    channel: input.channel,
    draft_text: input.draftText,
    source_origin: input.sourceOrigin,
    ai_model_used: input.sourceOrigin === "human" ? null : "claude-sonnet-4-6",
    prompt_hash: input.sourceOrigin === "human" ? null : "0".repeat(64),
    status: "pending",
  }).select("id, submitted_at").single();

  if (draftErr || !draft) return { error: "Failed to save draft: " + (draftErr?.message || "unknown") };

  // 2. Write 'submitted' action
  await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "submitted",
    actor_id: input.speakerId,
    actor_kind: "user",
    payload: { source_origin: input.sourceOrigin, channel: input.channel, campaign_id: input.campaignId },
  });

  // 3. Run checks
  const result = await runChecks(sb, DEMO_ORG_ID, input.draftText, draft.submitted_at);

  // 4. Write check_ran action for rule_check
  await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "check_ran",
    actor_kind: "ai_check",
    payload: {
      check: "rule_check",
      matches: result.rule_check.matches,
      match_count: result.rule_check.matches.length,
    },
    rules_active: result.rules_active,
  });

  // 5. Write check_ran action for timing_check
  await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "check_ran",
    actor_kind: "ai_check",
    payload: {
      check: "timing_check",
      rules_active_count: result.timing_check.rules_active_count,
      rules_inactive_count: result.timing_check.rules_inactive_count,
      submitted_at: result.timing_check.submitted_at,
    },
    rules_active: result.rules_active,
  });

  // 6. Write verdict_issued action
  const checks = buildChecksArray(result, input.sourceOrigin);
  await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "verdict_issued",
    actor_kind: "system",
    payload: {
      verdict: result.verdict,
      primary_match: result.primary_match,
      checks_passed: ["rule_check", "timing_check"],
      checks,
    },
    rules_active: result.rules_active,
  });

  // 7. Update draft.status
  const newStatus = verdictToStatus(result.verdict);
  await sb.from("drafts").update({ status: newStatus }).eq("id", draft.id);

  return {
    draftId: draft.id,
    verdict: result.verdict,
    primaryMatch: result.primary_match,
    checks,
  };
}
