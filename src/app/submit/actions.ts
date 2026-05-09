"use server";

import { resolveOrgId } from "@/lib/auth-helpers";
import {
  runChecks,
  runConsistencyCheck,
  verdictToStatus,
  getSupabaseAdmin,
  buildChecksArray,
} from "@/lib/checks";
import type { CheckEntry, CommunicationCategory, Verdict } from "@/lib/checks";

// Channels that are inherently public reach a retail audience and can never
// downgrade to correspondence / institutional. Used as the auto-set rule
// when the form doesn't pass an explicit category.
const PUBLIC_CHANNELS = new Set(["linkedin", "twitter", "blog", "press_release"]);

/**
 * Resolve the FINRA Rule 2210 communication category for a submission.
 * The form passes an explicit category when the user picked one — that
 * always wins. Otherwise we fall back to channel + audience_size:
 *   • audience_size ≤ 25                 → correspondence
 *   • email without size                 → correspondence (default)
 *   • linkedin/twitter/blog/press_release → retail (public reach)
 *   • anything else                      → retail (conservative default)
 */
function resolveCommunicationCategory(
  channel: string,
  audienceSize: number | null | undefined,
  explicit: CommunicationCategory | undefined,
): CommunicationCategory {
  if (explicit) return explicit;
  if (typeof audienceSize === "number" && audienceSize <= 25) return "correspondence";
  if (PUBLIC_CHANNELS.has(channel)) return "retail";
  if (channel === "email" && (audienceSize === null || audienceSize === undefined)) {
    return "correspondence";
  }
  return "retail";
}

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
  // FINRA Rule 2210 category. The submit form picks one; absent →
  // computed from channel + audience_size.
  communicationCategory?: CommunicationCategory;
  // Optional headcount of intended retail recipients. Used for the
  // "≤25 retail investors" correspondence rule when no explicit category
  // is supplied.
  audienceSize?: number | null;
  // Origin of the submission request. "web_app" when a browser session
  // hits the submit form; "api" when the API path is used (a future
  // route can pass this through). Recorded on the `submitted` action
  // payload and surfaced on the examiner record.
  submissionMethod?: "web_app" | "api";
};

export type SubmitSuccess = {
  draftId: string;
  verdict: Verdict;
  ruleName?: string;
  ruleDescription?: string;
  matchedKeyword?: string;
  checks: CheckEntry[];
  // Surfaced to the submit form so the post-verdict panel can show
  // "N statements checked · no contradictions" and the rule's
  // effectiveness score in context. Both are derived inline below
  // from the existing checks output + a small effectiveness lookup.
  consistencyResult?: {
    corpusSize: number;
    result: "pass" | "fail" | "warn";
  };
  ruleMatch?: {
    name: string;
    effectiveness: number | null;
  } | null;
  error?: undefined;
};
type SubmitResult = SubmitSuccess | { draftId?: undefined; error: string };

export async function submitDraftAction(input: SubmitInput): Promise<SubmitResult> {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  if (!input.draftText.trim()) return { error: "Draft text cannot be empty." };
  if (!input.speakerName) return { error: "Speaker is required." };

  // Resolve speaker name → user id (FK constraint in drafts.speaker_id).
  const { data: speaker, error: speakerErr } = await sb
    .from("users")
    .select("id")
    .eq("org_id", orgId)
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
      .eq("org_id", orgId)
      .eq("name", input.campaignName)
      .maybeSingle();
    campaignId = (campaign?.id as string | undefined) ?? null;
  }

  // Map submissionType + sourceOrigin → final source_origin column value.
  // Agent submissions are tagged "agent_submitted" regardless of the EU AI
  // Act checkbox; human submissions defer to the checkbox-derived value.
  const finalSourceOrigin =
    input.submissionType === "agent" ? "agent_submitted" : input.sourceOrigin;

  // 1. Insert draft. The submit form now collects the FINRA Rule 2210
  //    category explicitly; if absent we fall back to channel + audience_size
  //    heuristics. content_type / intended_audience still default to the
  //    strictest standard pending dedicated form fields.
  const communicationCategory = resolveCommunicationCategory(
    input.channel,
    input.audienceSize,
    input.communicationCategory,
  );
  // intended_audience is the column-side analogue of the category — keep
  // them aligned so the examiner record (which reads intended_audience)
  // stays consistent with the verdict logic (which reads category).
  const intendedAudience: "public" | "limited" | "institutional" =
    communicationCategory === "institutional"
      ? "institutional"
      : communicationCategory === "correspondence"
        ? "limited"
        : "public";
  const trimmedPrompt = input.promptUsed?.trim();
  const { data: draft, error: draftErr } = await sb.from("drafts").insert({
    org_id: orgId,
    speaker_id: speakerId,
    campaign_id: campaignId,
    channel: input.channel,
    draft_text: input.draftText,
    source_origin: finalSourceOrigin,
    ai_model_used: finalSourceOrigin === "human" ? null : "claude-sonnet-4-6",
    prompt_hash: finalSourceOrigin === "human" ? null : "0".repeat(64),
    status: "pending",
    communication_category: communicationCategory,
    content_type: "static",
    intended_audience: intendedAudience,
    ...(trimmedPrompt ? { prompt_used: trimmedPrompt } : {}),
  }).select("id, submitted_at").single();

  if (draftErr || !draft) return { error: "Failed to save draft: " + (draftErr?.message || "unknown") };

  // 2. submitted action (records the actor + submission type +
  //    request origin). submission_method defaults to "web_app" when
  //    the form doesn't pass one — the submit form always does, but
  //    older callers / the future API path may not.
  const submissionMethod = input.submissionMethod ?? "web_app";
  await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "submitted",
    actor_id: speakerId,
    actor_kind: "user",
    payload: {
      source_origin: finalSourceOrigin,
      submission_type: input.submissionType,
      submission_method: submissionMethod,
      channel: input.channel,
      campaign_id: campaignId,
    },
  });

  // 3. Run checks. The category drives Stage 3 of the rule check — a hard
  //    BLOCK on a non-retail communication relaxes to ESCALATE under
  //    FINRA Rule 2210 (no pre-approval bar for correspondence /
  //    institutional). Stage 2 (Claude context evaluation) runs inside
  //    runChecks when ANTHROPIC_API_KEY is set.
  const result = await runChecks(
    sb,
    orgId,
    input.draftText,
    draft.submitted_at,
    communicationCategory,
  );

  // 4. rule_check action
  await sb.from("actions").insert({
    org_id: orgId,
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
    org_id: orgId,
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
    orgId,
    speakerId,
    input.draftText,
  );

  // 7. verdict_issued action. Includes the Stage 1 base verdict + Stage 2
  //    context evaluation reasoning + the category so the examiner record
  //    can fully reconstruct how the final verdict was reached.
  const checks = buildChecksArray(result, finalSourceOrigin, consistencyResult);
  await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "verdict_issued",
    actor_kind: "system",
    payload: {
      verdict: result.verdict,
      base_verdict: result.base_verdict,
      primary_match: result.primary_match,
      communication_category: communicationCategory,
      checks_passed: ["rule_check", "timing_check"],
      checks,
      ...(result.context_evaluation
        ? { context_evaluation: result.context_evaluation }
        : {}),
      ...(result.context_unavailable_reason
        ? { context_unavailable_reason: result.context_unavailable_reason }
        : {}),
      ...(consistencyResult.result === "warn"
        ? { consistency_warning: consistencyResult.detail }
        : {}),
    },
    rules_active: result.rules_active,
  });

  // 8. Update draft.status
  const newStatus = verdictToStatus(result.verdict);
  await sb.from("drafts").update({ status: newStatus }).eq("id", draft.id);

  // 9a. Pull the Consistency Check entry out of the existing checks
  //     array — it already has corpus_size + a pass/warn result, which
  //     is everything the post-verdict governance panel needs.
  const consistencyEntry = checks.find((c) => c.check_name === "Consistency Check");
  const consistencyResultOut = consistencyEntry
    ? {
        corpusSize: consistencyEntry.corpus_size ?? 0,
        result: consistencyEntry.result,
      }
    : undefined;

  // 9b. If this draft tripped a rule, compute that rule's historical
  //     effectiveness — (matches − overrides) / matches × 100 — by
  //     looking at past verdict_issued payloads against the same
  //     rule_name and joining to drafts.status. Skipped when no rule
  //     matched. The lookup excludes the current draft so the score
  //     reflects how the rule has performed before this submission.
  let ruleMatchOut: { name: string; effectiveness: number | null } | null = null;
  if (result.primary_match) {
    const ruleName = result.primary_match.rule_name;
    const { data: pastVerdicts } = await sb
      .from("actions")
      .select("draft_id, payload")
      .eq("org_id", orgId)
      .eq("action_type", "verdict_issued")
      .neq("draft_id", draft.id);
    type PastVerdict = {
      draft_id: string;
      payload: { primary_match?: { rule_name?: string } | null };
    };
    const matched = ((pastVerdicts ?? []) as PastVerdict[]).filter(
      (v) => v.payload?.primary_match?.rule_name === ruleName,
    );
    let effectiveness: number | null = null;
    if (matched.length > 0) {
      const { data: matchedDrafts } = await sb
        .from("drafts")
        .select("id, status")
        .in(
          "id",
          matched.map((m) => m.draft_id),
        );
      const overrides = ((matchedDrafts ?? []) as Array<{ status: string }>).filter(
        (d) => d.status === "overridden",
      ).length;
      effectiveness = Math.round(((matched.length - overrides) / matched.length) * 100);
    }
    ruleMatchOut = { name: ruleName, effectiveness };
  }

  // 10. Flat return shape — primary_match unfolded into rule* fields so the
  //     form can render directly without reaching into a nested object.
  return {
    draftId: draft.id,
    verdict: result.verdict,
    ruleName: result.primary_match?.rule_name,
    ruleDescription: result.primary_match?.rule_description,
    matchedKeyword: result.primary_match?.matched_keyword,
    checks,
    ...(consistencyResultOut ? { consistencyResult: consistencyResultOut } : {}),
    ruleMatch: ruleMatchOut,
  };
}
