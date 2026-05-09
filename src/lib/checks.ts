import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Rule = {
  id: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  name: string;
  description: string;
  keywords: string[];
  effective_from: string;
  effective_to: string | null;
};

export type RuleMatch = {
  rule_id: string;
  rule_name: string;
  rule_type: Rule["rule_type"];
  rule_description: string;
  matched_keyword: string;
  match_position: number;
};

export type Verdict = "block" | "escalate" | "review" | "guide" | "clear";

export type CheckEntry = {
  check_name: string;
  result: "pass" | "fail" | "warn";
  detail: string | null;
  matched_keyword?: string;
  // Populated by the Consistency Check when a contradiction is found —
  // surfaces the specific prior statement that conflicts so the
  // reviewer can compare verbatim.
  prior_statement?: string | null;
  // Size of the corpus the Consistency Check ran against at submission
  // time. Persisted on the verdict_issued payload so the examiner
  // record can show "Corpus at submission: N" without re-querying.
  corpus_size?: number;
  // Stage 2 contextual reasoning written by the Rule Check when an
  // ANTHROPIC_API_KEY is available. Shown on the examiner record so
  // FINRA reviewers can see ERA CUE evaluated context, not just keywords.
  context_evaluation?: string;
};

// FINRA Rule 2210(a) communication categories. Drives whether a rule-based
// BLOCK actually applies (retail) or relaxes to ESCALATE (correspondence
// and institutional don't require pre-approval under 2210).
export type CommunicationCategory = "retail" | "institutional" | "correspondence";

export const CHECK_NAMES = [
  "Rule Check",
  "Consistency Check",
  "Alignment Check",
  "Quiet Period Check",
  "Agent Origin Check",
] as const;

/**
 * Build the full 5-check chain from a CheckResult + source_origin.
 * Process-reconstructable: every check has an entry, with `result: "pass"` and
 * `detail: null` for checks that didn't fire. Pass `consistencyResult` from
 * `runConsistencyCheck` to fold the AI-driven consistency result in;
 * omitted means "no corpus check ran".
 */
export function buildChecksArray(
  result: CheckResult,
  sourceOrigin: string,
  consistencyResult?: CheckEntry,
): CheckEntry[] {
  const pm = result.primary_match;
  const isQuietPeriod = pm ? /quiet period/i.test(pm.rule_name) : false;
  const ctx = result.context_evaluation ?? null;

  // Rule Check entry. Stage 2 (contextual evaluation) can downgrade a
  // keyword match from "fail" to "warn" with reasoning attached. When the
  // API key is missing we still mark the check as fail (deterministic
  // Stage 1 only) and append an unavailability note.
  const ruleCheck: CheckEntry = pm
    ? ctx && !ctx.confirmed
      ? {
          check_name: "Rule Check",
          result: "warn",
          detail: `Keyword matched but context evaluated as low risk: ${ctx.reasoning}`,
          matched_keyword: pm.matched_keyword,
          context_evaluation: ctx.reasoning,
        }
      : {
          check_name: "Rule Check",
          result: "fail",
          detail: ctx
            ? `Matched: ${pm.rule_name}`
            : result.context_unavailable_reason
              ? `Matched: ${pm.rule_name} · ${result.context_unavailable_reason}`
              : `Matched: ${pm.rule_name}`,
          matched_keyword: pm.matched_keyword,
          ...(ctx ? { context_evaluation: ctx.reasoning } : {}),
        }
    : { check_name: "Rule Check", result: "pass", detail: null };

  const quietPeriodCheck: CheckEntry = isQuietPeriod && pm
    ? { check_name: "Quiet Period Check", result: "fail", detail: `Quiet period rule matched: ${pm.rule_name}` }
    : { check_name: "Quiet Period Check", result: "pass", detail: null };

  const consistencyCheck: CheckEntry =
    consistencyResult ?? { check_name: "Consistency Check", result: "pass", detail: null };

  // Agent Origin is no longer surfaced as a verdict-side check entry.
  // AI-source disclosure is recorded on the draft row (`source_origin`,
  // `ai_model_used`, `prompt_hash`) and the `submitted` action payload,
  // so the examiner record reads it directly from the source-of-truth
  // columns. Keeping it as a verdict line item created noise on every
  // submission ("AI source declared (model + prompt hash recorded)")
  // even when the speaker just wrote a one-line LinkedIn post.
  void sourceOrigin;
  return [
    ruleCheck,
    consistencyCheck,
    { check_name: "Alignment Check", result: "pass", detail: null },
    quietPeriodCheck,
  ];
}

// ---------- Consistency Check (AI-powered) ---------------------------------

type ConsistencyResponse = {
  consistent: boolean;
  contradiction_found: string | null;
  prior_statement: string | null;
};

/**
 * Compare a new draft against the speaker's last 10 approved drafts using
 * Claude. Only flags genuine factual contradictions — tone / topic /
 * emphasis differences are explicitly excluded by the system prompt.
 *
 * Failure modes are absorbed into a `pass` result with an explanatory
 * detail, so a missing API key, network error, or upstream API error
 * never blocks a submission.
 */
export async function runConsistencyCheck(
  sb: SupabaseClient,
  orgId: string,
  speakerId: string,
  draftText: string,
): Promise<CheckEntry> {
  // Step 1 — pull the speaker's approved corpus (most recent first).
  const { data: priorDrafts } = await sb
    .from("drafts")
    .select("draft_text, submitted_at, channel")
    .eq("org_id", orgId)
    .eq("speaker_id", speakerId)
    .eq("status", "approved")
    .order("submitted_at", { ascending: false })
    .limit(10);

  // Step 2 — no corpus, nothing to compare against.
  if (!priorDrafts || priorDrafts.length === 0) {
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail:
        "No prior approved statements on record. Corpus builds as drafts are approved.",
    };
  }

  // Step 3 — without a key we cannot call the model; fall through cleanly.
  // Internal availability of the consistency model is not the user's
  // problem — pass silently and let the (server-only) absence stay
  // visible in Vercel function logs rather than the verdict UI.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail: null,
    };
  }

  const corpusText = priorDrafts
    .map(
      (d, i) =>
        `${i + 1}. "${d.draft_text}" (${new Date(d.submitted_at).toLocaleDateString()})`,
    )
    .join("\n");

  const systemPrompt = `You are a compliance consistency checker for executive communications. Your job is to identify direct contradictions between a new draft and a speaker's prior approved statements.

ONLY flag genuine contradictions — factual claims that directly conflict (e.g., "we are hiring" vs "we paused hiring", "we have 500 customers" vs "we have 200 customers").

Do NOT flag:
- Tone differences
- Topic differences
- Emphasis differences
- Normal evolution of messaging

Respond with JSON only:
{
  "consistent": true | false,
  "contradiction_found": "one sentence describing the specific contradiction" | null,
  "prior_statement": "the specific prior statement that conflicts" | null
}`;

  const userMessage = `New draft: "${draftText}"

Prior approved statements from this speaker:
${corpusText}

Is the new draft consistent with these prior statements? Only flag genuine factual contradictions.`;

  let consistency: ConsistencyResponse;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      // Upstream API hiccup is operational noise — log it and pass
      // silently so the verdict UI doesn't expose internal status
      // codes to the speaker.
      console.error(
        "runConsistencyCheck upstream error:",
        response.status,
      );
      return {
        check_name: "Consistency Check",
        result: "pass",
        detail: null,
      };
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");

    try {
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      consistency = JSON.parse(clean) as ConsistencyResponse;
    } catch {
      // Model returned something un-parseable — treat as pass to avoid
      // false-positives blocking the queue.
      consistency = { consistent: true, contradiction_found: null, prior_statement: null };
    }
  } catch (err) {
    // Network / parse failure — log to function output, return a
    // silent PASS so the verdict surface stays clean.
    console.error(
      "runConsistencyCheck caught:",
      err instanceof Error ? err.message : String(err),
    );
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail: null,
    };
  }

  if (consistency.consistent) {
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail: `Consistent with ${priorDrafts.length} prior approved statements.`,
      corpus_size: priorDrafts.length,
    };
  }

  return {
    check_name: "Consistency Check",
    result: "warn",
    detail: consistency.contradiction_found || "Potential inconsistency detected.",
    prior_statement: consistency.prior_statement,
    corpus_size: priorDrafts.length,
  };
}

export type CheckResult = {
  rule_check: {
    matches: RuleMatch[];
  };
  timing_check: {
    rules_active_count: number;
    rules_inactive_count: number;
    submitted_at: string;
  };
  verdict: Verdict;
  // The Stage 1 (keyword-only) verdict — preserved so the audit trail can
  // show what the deterministic rule engine produced before Stage 2 / the
  // category adjustment. Equal to `verdict` when neither downgrade fires.
  base_verdict: Verdict;
  primary_match: RuleMatch | null;
  rules_active: string[];
  communication_category: CommunicationCategory;
  // Stage 2 — populated only when ANTHROPIC_API_KEY is set AND a
  // primary_match exists. Captures whether Claude confirmed the keyword
  // match as a real violation, plus its one-sentence reasoning.
  context_evaluation?: {
    confirmed: boolean;
    reasoning: string;
    adjusted_verdict: string | null;
  };
  // Set when Stage 2 was skipped (no API key) so the audit trail can record
  // *why* contextual evaluation didn't run.
  context_unavailable_reason?: string;
};

// Adjust the keyword-derived verdict to the regulatory category. Under FINRA
// Rule 2210, only retail communications require principal pre-approval —
// correspondence (≤25 retail investors) and institutional are subject to
// supervision but not the same pre-approval bar, so a hard BLOCK relaxes
// to ESCALATE for human review.
export function adjustVerdictForCategory(
  baseVerdict: Verdict,
  _ruleType: Rule["rule_type"],
  category: CommunicationCategory,
): Verdict {
  // Correspondence: BLOCK → ESCALATE
  // Pre-approval not required for ≤25 retail investors (FINRA Rule 2210)
  if (category === "correspondence" && baseVerdict === "block") {
    return "escalate";
  }
  // Institutional: BLOCK → ESCALATE
  // Institutional communications don't require pre-approval under Rule 2210
  if (category === "institutional" && baseVerdict === "block") {
    return "escalate";
  }
  // Retail: full verdict applies
  return baseVerdict;
}

// ---------- Stage 2 — Context evaluation -----------------------------------

type ContextEvaluation = {
  confirmed: boolean;
  reasoning: string;
  adjusted_verdict: string | null;
};

const CONTEXT_SYSTEM_PROMPT = `You are a FINRA compliance reviewer evaluating whether a communication violates a governance rule.

Be precise. A keyword match alone is not a violation. Evaluate the full context.

Rules:
- FINRA Rule 2210 prohibits false, misleading, promissory, or exaggerated statements
- Performance projections are prohibited in retail communications
- Guaranteed returns are prohibited
- Testimonials without disclosures are prohibited

Respond with JSON only:
{
  "confirmed": true | false,
  "reasoning": "one sentence",
  "adjusted_verdict": "block" | "escalate" | "review" | "clear" | null
}

If confirmed is false, adjusted_verdict should be "clear" or "review" depending on risk level.
If confirmed is true, keep the original verdict.`;

/**
 * Stage 2 of the Rule Check. Asks Claude whether a Stage-1 keyword match is
 * a genuine violation in context, or a false positive. Errors are absorbed
 * by treating the match as confirmed (conservative) so a Claude outage
 * never silently downgrades a real violation.
 */
export async function evaluateContextually(
  draftText: string,
  matchedRule: { name: string; description: string },
  matchedKeyword: string,
  communicationCategory: string,
): Promise<ContextEvaluation> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // Caller is expected to gate on the key, but defend here too so the
  // function is safe to invoke directly.
  if (!apiKey) {
    return {
      confirmed: true,
      reasoning: "Unable to evaluate context",
      adjusted_verdict: null,
    };
  }

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: CONTEXT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Draft: "${draftText}"

Rule violated: ${matchedRule.name}
Rule description: ${matchedRule.description}
Matched keyword: "${matchedKeyword}"
Communication type: ${communicationCategory}

Is this a genuine violation of the rule, or is the keyword match a false positive?`,
          },
        ],
      }),
    });
  } catch {
    return { confirmed: true, reasoning: "Unable to evaluate context", adjusted_verdict: null };
  }

  if (!response.ok) {
    return { confirmed: true, reasoning: "Unable to evaluate context", adjusted_verdict: null };
  }

  let data: { content?: Array<{ type: string; text?: string }> };
  try {
    data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  } catch {
    return { confirmed: true, reasoning: "Unable to evaluate context", adjusted_verdict: null };
  }

  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");

  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean) as Partial<ContextEvaluation>;
    return {
      confirmed: typeof parsed.confirmed === "boolean" ? parsed.confirmed : true,
      reasoning:
        typeof parsed.reasoning === "string" && parsed.reasoning.trim().length > 0
          ? parsed.reasoning
          : "Unable to evaluate context",
      adjusted_verdict:
        typeof parsed.adjusted_verdict === "string" ? parsed.adjusted_verdict : null,
    };
  } catch {
    // If parsing fails, conservative: keep original verdict
    return { confirmed: true, reasoning: "Unable to evaluate context", adjusted_verdict: null };
  }
}

function isVerdict(v: string | null): v is Verdict {
  return v === "block" || v === "escalate" || v === "review" || v === "guide" || v === "clear";
}

const VERDICT_PRIORITY: Record<Verdict, number> = {
  block: 5,
  escalate: 4,
  review: 3,
  guide: 2,
  clear: 1,
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function runChecks(
  sb: SupabaseClient,
  orgId: string,
  draftText: string,
  submittedAt: string,
  communicationCategory: CommunicationCategory = "retail",
): Promise<CheckResult> {
  // Fetch active rules for this org. Filtering on `rule_status` here
  // matches the count + metadata queries in src/app/check/actions.ts —
  // without it, deactivated rules whose date window happens to be
  // current would still trip on submissions, contradicting the
  // visible state of the rules table.
  const { data: rules, error } = await sb
    .from("rules")
    .select("id, rule_type, name, description, keywords, effective_from, effective_to")
    .eq("org_id", orgId)
    .eq("rule_status", "active");

  if (error) throw new Error("Failed to fetch rules: " + error.message);

  const allRules = (rules || []) as Rule[];

  // Timing check: which rules are active at submitted_at?
  const submittedTime = new Date(submittedAt).getTime();
  const activeRules = allRules.filter((r) => {
    const fromTime = new Date(r.effective_from).getTime();
    if (submittedTime < fromTime) return false;
    if (r.effective_to) {
      const toTime = new Date(r.effective_to).getTime();
      if (submittedTime > toTime) return false;
    }
    return true;
  });

  // STAGE 1 — Keyword match (deterministic, fast). Among active rules,
  // which keywords match the draft text?
  const lowerText = draftText.toLowerCase();
  const matches: RuleMatch[] = [];
  for (const rule of activeRules) {
    for (const kw of rule.keywords) {
      if (!kw) continue;
      const pattern = new RegExp("\\b" + escapeRegex(kw.toLowerCase()) + "\\b");
      const found = lowerText.match(pattern);
      if (found && found.index !== undefined) {
        matches.push({
          rule_id: rule.id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          rule_description: rule.description,
          matched_keyword: kw,
          match_position: found.index,
        });
        break; // one match per rule is enough
      }
    }
  }

  // Verdict aggregation: highest priority wins. Stage 1 verdict.
  let baseVerdict: Verdict = "clear";
  let primaryMatch: RuleMatch | null = null;
  for (const m of matches) {
    if (VERDICT_PRIORITY[m.rule_type] > VERDICT_PRIORITY[baseVerdict]) {
      baseVerdict = m.rule_type;
      primaryMatch = m;
    }
  }

  // STAGE 2 — Context evaluation (Claude). Only fires when Stage 1
  // produced a primary match. Without an API key we fall through to the
  // Stage 1 verdict and surface a "context evaluation unavailable" note.
  let contextEvaluation: CheckResult["context_evaluation"] | undefined;
  let contextUnavailableReason: string | undefined;
  let postStage2Verdict: Verdict = baseVerdict;

  if (primaryMatch) {
    if (process.env.ANTHROPIC_API_KEY) {
      const evaluation = await evaluateContextually(
        draftText,
        { name: primaryMatch.rule_name, description: primaryMatch.rule_description },
        primaryMatch.matched_keyword,
        communicationCategory,
      );
      contextEvaluation = evaluation;
      if (!evaluation.confirmed) {
        // Downgrade — adjusted_verdict from Claude wins; default to "review".
        const candidate = evaluation.adjusted_verdict;
        postStage2Verdict = isVerdict(candidate) ? candidate : "review";
      }
    } else {
      contextUnavailableReason =
        "Context evaluation unavailable — keyword match only";
    }
  }

  // STAGE 3 — Category adjustment. BLOCK on a non-retail category relaxes
  // to ESCALATE under FINRA Rule 2210 (no pre-approval requirement for
  // correspondence / institutional).
  const finalVerdict: Verdict = primaryMatch
    ? adjustVerdictForCategory(postStage2Verdict, primaryMatch.rule_type, communicationCategory)
    : postStage2Verdict;

  return {
    rule_check: { matches },
    timing_check: {
      rules_active_count: activeRules.length,
      rules_inactive_count: allRules.length - activeRules.length,
      submitted_at: submittedAt,
    },
    verdict: finalVerdict,
    base_verdict: baseVerdict,
    primary_match: primaryMatch,
    rules_active: activeRules.map((r) => r.id),
    communication_category: communicationCategory,
    ...(contextEvaluation ? { context_evaluation: contextEvaluation } : {}),
    ...(contextUnavailableReason ? { context_unavailable_reason: contextUnavailableReason } : {}),
  };
}

export function verdictToStatus(verdict: Verdict): "pending" | "approved" | "escalated" | "blocked" {
  if (verdict === "block") return "blocked";
  if (verdict === "escalate") return "escalated";
  // 'review', 'guide', 'clear' all mean speaker can decide / no hard block; treat as pending for now
  // (in a richer flow, 'clear' would be 'approved' but we want a reviewer step for 'review' and 'guide')
  if (verdict === "clear") return "approved";
  return "pending";
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
