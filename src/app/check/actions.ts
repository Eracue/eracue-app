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

// ---------- Default ruleset -----------------------------------------------
//
// When the org has zero `rule_status='active'` rules in the DB, the
// check action falls back to this hard-coded set. Same shape as the
// rules table (rule_type/keywords) so downstream rendering can treat
// a defaults run identically to a custom run; only the
// `usedDefaultRules` flag tells the client to label the section
// "ERA CUE default governance rules" rather than "your active rules".
//
// Keyword matching mirrors `runChecks` Stage 1 (whole-word, case-
// insensitive). Stage 2 (Claude context) and Stage 3 (Reg-2210 category
// adjustment) are skipped on the defaults path — defaults are
// illustrative scaffolding, not regulatory citations, so the simpler
// match-and-go behaviour is intentional.

type DefaultRule = {
  id: string;
  name: string;
  rule_type: "block" | "review";
  keywords: string[];
};

const DEFAULT_RULES: ReadonlyArray<DefaultRule> = [
  {
    id: "default-1",
    name: "Quiet Period Language",
    rule_type: "block",
    keywords: [
      "fundraising",
      "raising",
      "investors",
      "closing our round",
      "series",
    ],
  },
  {
    id: "default-2",
    name: "Forward Guidance",
    rule_type: "block",
    keywords: ["expects", "projects", "anticipates", "guidance", "outlook"],
  },
  {
    id: "default-3",
    name: "Material Information",
    rule_type: "block",
    keywords: [
      "material",
      "non-public",
      "confidential deal",
      "embargoed",
      "not yet announced",
    ],
  },
  {
    id: "default-4",
    name: "Competitor Disparagement",
    rule_type: "review",
    keywords: [
      "unlike our competitors",
      "better than any competitor",
      "no competitor can",
    ],
  },
  {
    id: "default-5",
    name: "Unsubstantiated Claims",
    rule_type: "review",
    keywords: ["guaranteed", "always works", "never fails", "100% proven"],
  },
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match the draft text against DEFAULT_RULES using the same whole-word
// keyword logic as `runChecks`. Returns the per-rule pass/triggered
// breakdown; the caller picks the highest-priority verdict.
function matchAgainstDefaults(draftText: string): Array<{
  rule: DefaultRule;
  triggered: boolean;
  matchedKeyword?: string;
}> {
  const lower = draftText.toLowerCase();
  const out: Array<{
    rule: DefaultRule;
    triggered: boolean;
    matchedKeyword?: string;
  }> = [];
  for (const rule of DEFAULT_RULES) {
    let hit: string | undefined;
    for (const kw of rule.keywords) {
      if (!kw) continue;
      const re = new RegExp("\\b" + escapeRegex(kw.toLowerCase()) + "\\b");
      if (re.test(lower)) {
        hit = kw;
        break;
      }
    }
    out.push({
      rule,
      triggered: hit !== undefined,
      ...(hit !== undefined ? { matchedKeyword: hit } : {}),
    });
  }
  return out;
}

const VERDICT_PRIORITY: Record<DefaultRule["rule_type"], number> = {
  block: 4,
  review: 2,
};

// ---------- Communication category resolution ----------------------------

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
  // Optional speaker title (when "Other" is chosen and the user types
  // their own title; ignored for known speakers since we already have
  // their title from `users.title`).
  speakerTitle?: string | null;
  // Optional campaign-scoped rule allowlist. When supplied, the action
  // only runs the listed rule ids — the campaign-rule editor on the
  // programs page surfaces what's in scope. An empty array means the
  // campaign exists but has no rules attached, which we treat as the
  // implicit-all default (run everything the org has active).
  campaignScopedRuleIds?: string[];
};

// Per-rule check result returned alongside the verdict so the form can
// render the "Rules checked (N total · X triggered · Y passed)" panel
// without re-querying the rules table.
export type RuleResult = {
  ruleId: string;
  ruleName: string;
  verdict: "block" | "review" | "escalate" | "guide";
  triggered: boolean;
  matchedKeyword?: string;
  regulatoryBasis?: string;
  authorizedBy?: string;
};

export type CampaignConsistencyResult = {
  priorCount: number;
  gap: boolean;
  // Keywords that the current draft contains AND that appeared in
  // prior CLEARED drafts for the same campaign. A non-empty list is
  // a proxy for "the team has previously cleared the same language;
  // why is it being blocked now?" — the surface is informational and
  // doesn't change the verdict.
  gapKeywords?: string[];
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
  // Defaults flag — true when the org had zero active rules and the
  // check ran against DEFAULT_RULES. Drives the "ERA CUE default
  // governance rules" labelling on the form.
  usedDefaultRules: boolean;
  // Per-rule pass/triggered breakdown for the "Rules checked" section
  // on the verdict view. Always present (empty only when both the org
  // and the defaults somehow yielded no rules).
  ruleResults: RuleResult[];
  // Every rule that triggered, ordered as encountered. The verdict
  // header switches to a multi-rule banner when this has length > 1.
  triggeredRules: RuleResult[];
  // Live count of rules actually checked on this submission — the
  // form swaps in this number wherever the page-load ruleCount was
  // shown so the verdict reflects the run, not the snapshot.
  ruleCountChecked: number;
  // Routing target for the BLOCK "Route to … for review" card.
  // First-triggered rule's authorized_by, or null when nothing
  // triggered or the matched rule has no authorized_by on file.
  authorizedBy?: string | null;
  // Campaign consistency check — only populated when the submission
  // had a non-null campaignName.
  campaignConsistency?: CampaignConsistencyResult;
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
      ...(input.speakerTitle ? { speaker_title: input.speakerTitle } : {}),
    },
  });

  // 3. Decide which ruleset to run. Count active rules; if zero, fall
  //    through to the DEFAULT_RULES path (in-memory keyword match
  //    only — no Stage 2 / Stage 3). When campaignScopedRuleIds is
  //    present and non-empty, runChecks happens but we filter the
  //    matches/rules-active list down to the campaign scope after
  //    the fact (re-running runChecks on a sub-rule list would
  //    require a refactor in lib/checks; filtering downstream is
  //    safe and surface-only).
  const { count: activeRuleCount } = await sb
    .from("rules")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("rule_status", "active");

  const usedDefaultRules = (activeRuleCount ?? 0) === 0;

  // Rule metadata used for the per-rule breakdown returned to the
  // client. For the defaults path we have it inline; for the DB path
  // we fetch it once here (runChecks does its own select internally
  // but doesn't return the description / regulatory_basis / authorized_by
  // fields the form needs).
  type DbRuleMeta = {
    id: string;
    name: string;
    rule_type: "block" | "review" | "escalate" | "guide";
    keywords: string[];
    description?: string | null;
    regulatory_basis?: string | null;
    authorized_by?: string | null;
    effective_from?: string | null;
    effective_to?: string | null;
    rule_status?: string | null;
  };
  let dbRules: DbRuleMeta[] = [];
  if (!usedDefaultRules) {
    const { data: rulesRaw } = await sb
      .from("rules")
      .select(
        "id, name, rule_type, keywords, description, regulatory_basis, authorized_by, effective_from, effective_to, rule_status",
      )
      .eq("org_id", orgId)
      .eq("rule_status", "active");
    dbRules = (rulesRaw ?? []) as DbRuleMeta[];
  }

  type CheckResultLike = {
    rule_check: {
      matches: Array<{
        rule_id: string;
        rule_name: string;
        rule_type: "block" | "review" | "escalate" | "guide";
        rule_description: string;
        matched_keyword: string;
        match_position: number;
      }>;
    };
    timing_check: {
      rules_active_count: number;
      rules_inactive_count: number;
      submitted_at: string;
    };
    verdict: Verdict;
    base_verdict: Verdict;
    primary_match:
      | {
          rule_id: string;
          rule_name: string;
          rule_type: "block" | "review" | "escalate" | "guide";
          rule_description: string;
          matched_keyword: string;
          match_position: number;
        }
      | null;
    rules_active: string[];
    communication_category: CommunicationCategory;
    context_evaluation?: {
      confirmed: boolean;
      reasoning: string;
      adjusted_verdict: string | null;
    };
    context_unavailable_reason?: string;
  };

  let result: CheckResultLike;
  if (usedDefaultRules) {
    const matched = matchAgainstDefaults(input.draftText);
    const rawMatches = matched
      .filter((m) => m.triggered)
      .map((m) => ({
        rule_id: m.rule.id,
        rule_name: m.rule.name,
        rule_type: m.rule.rule_type,
        rule_description: "",
        matched_keyword: m.matchedKeyword ?? "",
        match_position: 0,
      }));
    let baseVerdict: Verdict = "clear";
    let primaryMatch: CheckResultLike["primary_match"] = null;
    for (const m of rawMatches) {
      const prio = VERDICT_PRIORITY[m.rule_type as keyof typeof VERDICT_PRIORITY] ?? 0;
      const cur =
        baseVerdict === "block" ? 4 : baseVerdict === "review" ? 2 : 0;
      if (prio > cur) {
        baseVerdict = m.rule_type;
        primaryMatch = m;
      }
    }
    result = {
      rule_check: { matches: rawMatches },
      timing_check: {
        rules_active_count: DEFAULT_RULES.length,
        rules_inactive_count: 0,
        submitted_at: draft.submitted_at,
      },
      verdict: baseVerdict,
      base_verdict: baseVerdict,
      primary_match: primaryMatch,
      rules_active: DEFAULT_RULES.map((r) => r.id),
      communication_category: communicationCategory,
      context_unavailable_reason:
        "Default ruleset — context evaluation skipped",
    };
  } else {
    result = (await runChecks(
      sb,
      orgId,
      input.draftText,
      draft.submitted_at,
      communicationCategory,
    )) as CheckResultLike;
  }

  // Apply campaign rule scoping (DB path only — defaults are global).
  let scopedResult = result;
  if (
    !usedDefaultRules &&
    input.campaignScopedRuleIds &&
    input.campaignScopedRuleIds.length > 0
  ) {
    const allowed = new Set(input.campaignScopedRuleIds);
    const filteredMatches = result.rule_check.matches.filter((m) =>
      allowed.has(m.rule_id),
    );
    let scopedBase: Verdict = "clear";
    let scopedPrimary: CheckResultLike["primary_match"] = null;
    for (const m of filteredMatches) {
      const prio =
        m.rule_type === "block"
          ? 4
          : m.rule_type === "escalate"
            ? 3
            : m.rule_type === "review"
              ? 2
              : 1;
      const cur =
        scopedBase === "block"
          ? 4
          : scopedBase === "escalate"
            ? 3
            : scopedBase === "review"
              ? 2
              : scopedBase === "guide"
                ? 1
                : 0;
      if (prio > cur) {
        scopedBase = m.rule_type;
        scopedPrimary = m;
      }
    }
    scopedResult = {
      ...result,
      rule_check: { matches: filteredMatches },
      verdict: scopedBase,
      base_verdict: scopedBase,
      primary_match: scopedPrimary,
      rules_active: result.rules_active.filter((id) => allowed.has(id)),
    };
  }

  // 4. rule_check action
  await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "check_ran",
    actor_kind: "ai_check",
    payload: {
      check: "rule_check",
      matches: scopedResult.rule_check.matches,
      match_count: scopedResult.rule_check.matches.length,
      used_default_rules: usedDefaultRules,
    },
    rules_active: scopedResult.rules_active,
  });

  // 5. timing_check action
  await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "check_ran",
    actor_kind: "ai_check",
    payload: {
      check: "timing_check",
      rules_active_count: scopedResult.timing_check.rules_active_count,
      rules_inactive_count: scopedResult.timing_check.rules_inactive_count,
      submitted_at: scopedResult.timing_check.submitted_at,
    },
    rules_active: scopedResult.rules_active,
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
  const checks = buildChecksArray(scopedResult, finalSourceOrigin, consistencyResult);
  await sb.from("actions").insert({
    org_id: orgId,
    draft_id: draft.id,
    action_type: "verdict_issued",
    actor_kind: "system",
    payload: {
      verdict: scopedResult.verdict,
      base_verdict: scopedResult.base_verdict,
      primary_match: scopedResult.primary_match,
      communication_category: communicationCategory,
      checks_passed: ["rule_check", "timing_check"],
      checks,
      used_default_rules: usedDefaultRules,
      ...(scopedResult.context_evaluation
        ? { context_evaluation: scopedResult.context_evaluation }
        : {}),
      ...(scopedResult.context_unavailable_reason
        ? { context_unavailable_reason: scopedResult.context_unavailable_reason }
        : {}),
      ...(consistencyResult.result === "warn"
        ? { consistency_warning: consistencyResult.detail }
        : {}),
    },
    rules_active: scopedResult.rules_active,
  });

  // 8. Update draft.status
  const newStatus = verdictToStatus(scopedResult.verdict);
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
  if (scopedResult.primary_match && !usedDefaultRules) {
    const ruleName = scopedResult.primary_match.rule_name;
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

  // 10. Build the per-rule pass/triggered breakdown for the verdict
  //     view. Defaults path: walk the in-memory matched array.
  //     DB path: walk dbRules and pair each with whatever scopedResult
  //     contains. Always returns one entry per rule that ran.
  const matchByRuleId = new Map<
    string,
    CheckResultLike["rule_check"]["matches"][number]
  >();
  for (const m of scopedResult.rule_check.matches) {
    matchByRuleId.set(m.rule_id, m);
  }

  let ruleResults: RuleResult[];
  if (usedDefaultRules) {
    const matched = matchAgainstDefaults(input.draftText);
    ruleResults = matched.map((m) => ({
      ruleId: m.rule.id,
      ruleName: m.rule.name,
      verdict: m.rule.rule_type,
      triggered: m.triggered,
      ...(m.matchedKeyword ? { matchedKeyword: m.matchedKeyword } : {}),
    }));
  } else {
    const allowed =
      input.campaignScopedRuleIds && input.campaignScopedRuleIds.length > 0
        ? new Set(input.campaignScopedRuleIds)
        : null;
    ruleResults = dbRules
      .filter((r) => (allowed ? allowed.has(r.id) : true))
      .map((r) => {
        const m = matchByRuleId.get(r.id);
        return {
          ruleId: r.id,
          ruleName: r.name,
          verdict: r.rule_type,
          triggered: !!m,
          ...(m?.matched_keyword ? { matchedKeyword: m.matched_keyword } : {}),
          ...(r.regulatory_basis
            ? { regulatoryBasis: r.regulatory_basis }
            : {}),
          ...(r.authorized_by ? { authorizedBy: r.authorized_by } : {}),
        };
      });
  }

  const triggeredRules = ruleResults.filter((r) => r.triggered);
  const authorizedBy =
    triggeredRules.length > 0 ? (triggeredRules[0].authorizedBy ?? null) : null;
  const ruleCountChecked = ruleResults.length;

  // 11. Campaign consistency check. Only runs when the submission has
  //     a resolvable campaign id. Pulls prior CLEARED drafts for the
  //     same campaign and computes keyword overlap with the current
  //     draft using the union of triggered + non-triggered BLOCK rules
  //     (defaults or DB). A non-empty overlap means the team has
  //     previously cleared the same language — surfaced as an amber
  //     "possible consistency gap" indicator on the form.
  let campaignConsistency: CampaignConsistencyResult | undefined;
  if (campaignId) {
    const { data: priorCleared } = await sb
      .from("drafts")
      .select("draft_text")
      .eq("org_id", orgId)
      .eq("campaign_id", campaignId)
      .in("status", ["approved", "overridden"])
      .neq("id", draft.id);
    const priors = ((priorCleared ?? []) as Array<{ draft_text: string }>).map(
      (d) => d.draft_text.toLowerCase(),
    );
    // Keyword universe: every BLOCK keyword from the ruleset that
    // applied to this submission. Defaults path uses DEFAULT_RULES;
    // DB path uses dbRules (already filtered to active rules).
    const blockKeywords: string[] = [];
    if (usedDefaultRules) {
      for (const r of DEFAULT_RULES) {
        if (r.rule_type === "block") blockKeywords.push(...r.keywords);
      }
    } else {
      const allowed =
        input.campaignScopedRuleIds && input.campaignScopedRuleIds.length > 0
          ? new Set(input.campaignScopedRuleIds)
          : null;
      for (const r of dbRules) {
        if (allowed && !allowed.has(r.id)) continue;
        if (r.rule_type === "block") blockKeywords.push(...(r.keywords ?? []));
      }
    }
    const lowerDraft = input.draftText.toLowerCase();
    const gapKeywords: string[] = [];
    for (const kw of blockKeywords) {
      if (!kw) continue;
      const lowerKw = kw.toLowerCase();
      if (!lowerDraft.includes(lowerKw)) continue;
      // Did at least one prior CLEARED draft contain the same keyword?
      if (priors.some((p) => p.includes(lowerKw))) {
        gapKeywords.push(kw);
      }
    }
    campaignConsistency = {
      priorCount: priors.length,
      gap: gapKeywords.length > 0,
      ...(gapKeywords.length > 0
        ? { gapKeywords: Array.from(new Set(gapKeywords)) }
        : {}),
    };
  }

  // 12. Flat return shape — primary_match unfolded into rule* fields so the
  //     form can render directly without reaching into a nested object.
  return {
    draftId: draft.id,
    verdict: scopedResult.verdict,
    ruleName: scopedResult.primary_match?.rule_name,
    ruleDescription: scopedResult.primary_match?.rule_description,
    matchedKeyword: scopedResult.primary_match?.matched_keyword,
    checks,
    ...(consistencyResultOut ? { consistencyResult: consistencyResultOut } : {}),
    ruleMatch: ruleMatchOut,
    usedDefaultRules,
    ruleResults,
    triggeredRules,
    ruleCountChecked,
    authorizedBy,
    ...(campaignConsistency ? { campaignConsistency } : {}),
  };
}
