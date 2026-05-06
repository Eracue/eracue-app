"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import {
  runChecks,
  runConsistencyCheck,
  verdictToStatus,
  getSupabaseAdmin,
  buildChecksArray,
} from "@/lib/checks";
import type { CheckEntry, Verdict } from "@/lib/checks";

type SubmitInput = {
  draftText: string;
  speakerName: string;
  channel: string;
  // What the form computed from the EU AI Act checkbox: "ai_assisted" | "human"
  sourceOrigin: string;
  // FINRA agentic AI flag — agent overrides sourceOrigin to "agent_submitted"
  submissionType: "human" | "agent";
  campaignName: string | null;
  // FINRA 2026 GenAI prompt-logging — only stored when AI involvement is
  // declared and the user actually pasted a prompt. Empty / missing → field
  // is omitted from the insert (so older schemas without the column don't
  // 500 on this code path).
  promptUsed?: string;
};

export type SubmitSuccess = {
  draftId: string;
  verdict: Verdict;
  ruleName?: string;
  ruleDescription?: string;
  matchedKeyword?: string;
  checks: CheckEntry[];
  error?: undefined;
};
type SubmitResult = SubmitSuccess | { draftId?: undefined; error: string };

export async function submitDraftAction(input: SubmitInput): Promise<SubmitResult> {
  const sb = getSupabaseAdmin();

  if (!input.draftText.trim()) return { error: "Draft text cannot be empty." };
  if (!input.speakerName) return { error: "Speaker is required." };

  // Resolve speaker name → user id (FK constraint in drafts.speaker_id).
  const { data: speaker, error: speakerErr } = await sb
    .from("users")
    .select("id")
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", input.speakerName)
    .maybeSingle();
  if (speakerErr) return { error: "Failed to resolve speaker: " + speakerErr.message };
  if (!speaker) return { error: `Speaker not found: ${input.speakerName}` };
  const speakerId = speaker.id as string;

  // Resolve campaign name → id (optional; missing campaign just goes null).
  let campaignId: string | null = null;
  if (input.campaignName) {
    const { data: campaign } = await sb
      .from("campaigns")
      .select("id")
      .eq("org_id", DEMO_ORG_ID)
      .eq("name", input.campaignName)
      .maybeSingle();
    campaignId = (campaign?.id as string | undefined) ?? null;
  }

  // Map submissionType + sourceOrigin → final source_origin column value.
  // Agent submissions are tagged "agent_submitted" regardless of the EU AI
  // Act checkbox; human submissions defer to the checkbox-derived value.
  const finalSourceOrigin =
    input.submissionType === "agent" ? "agent_submitted" : input.sourceOrigin;

  // 1. Insert draft. The form no longer collects FINRA Rule 2210 classification
  //    fields, so we default to retail/static/public — the strictest standard.
  //    `prompt_used` is conditionally spread so the insert remains compatible
  //    with schemas that haven't yet had the FINRA-2026 column added.
  const trimmedPrompt = input.promptUsed?.trim();
  const { data: draft, error: draftErr } = await sb.from("drafts").insert({
    org_id: DEMO_ORG_ID,
    speaker_id: speakerId,
    campaign_id: campaignId,
    channel: input.channel,
    draft_text: input.draftText,
    source_origin: finalSourceOrigin,
    ai_model_used: finalSourceOrigin === "human" ? null : "claude-sonnet-4-6",
    prompt_hash: finalSourceOrigin === "human" ? null : "0".repeat(64),
    status: "pending",
    communication_category: "retail",
    content_type: "static",
    intended_audience: "public",
    ...(trimmedPrompt ? { prompt_used: trimmedPrompt } : {}),
  }).select("id, submitted_at").single();

  if (draftErr || !draft) return { error: "Failed to save draft: " + (draftErr?.message || "unknown") };

  // 2. submitted action (records the actor + submission type)
  await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "submitted",
    actor_id: speakerId,
    actor_kind: "user",
    payload: {
      source_origin: finalSourceOrigin,
      submission_type: input.submissionType,
      channel: input.channel,
      campaign_id: campaignId,
    },
  });

  // 3. Run checks
  const result = await runChecks(sb, DEMO_ORG_ID, input.draftText, draft.submitted_at);

  // 4. rule_check action
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

  // 5. timing_check action
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

  // 6. Consistency Check — Claude compares draft against the speaker's
  //    last 10 approved drafts. A 'warn' result is informational and does
  //    not change the verdict; the warning text rides along on the
  //    verdict payload as `consistency_warning` so the reviewer sees it.
  const consistencyResult = await runConsistencyCheck(
    sb,
    DEMO_ORG_ID,
    speakerId,
    input.draftText,
  );

  // 7. verdict_issued action
  const checks = buildChecksArray(result, finalSourceOrigin, consistencyResult);
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
      ...(consistencyResult.result === "warn"
        ? { consistency_warning: consistencyResult.detail }
        : {}),
    },
    rules_active: result.rules_active,
  });

  // 8. Update draft.status
  const newStatus = verdictToStatus(result.verdict);
  await sb.from("drafts").update({ status: newStatus }).eq("id", draft.id);

  // 9. Flat return shape — primary_match unfolded into rule* fields so the
  //    form can render directly without reaching into a nested object.
  return {
    draftId: draft.id,
    verdict: result.verdict,
    ruleName: result.primary_match?.rule_name,
    ruleDescription: result.primary_match?.rule_description,
    matchedKeyword: result.primary_match?.matched_keyword,
    checks,
  };
}
