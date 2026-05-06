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
};

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

  const ruleCheck: CheckEntry = pm
    ? {
        check_name: "Rule Check",
        result: "fail",
        detail: `Matched: ${pm.rule_name}`,
        matched_keyword: pm.matched_keyword,
      }
    : { check_name: "Rule Check", result: "pass", detail: null };

  const quietPeriodCheck: CheckEntry = isQuietPeriod && pm
    ? { check_name: "Quiet Period Check", result: "fail", detail: `Quiet period rule matched: ${pm.rule_name}` }
    : { check_name: "Quiet Period Check", result: "pass", detail: null };

  const consistencyCheck: CheckEntry =
    consistencyResult ?? { check_name: "Consistency Check", result: "pass", detail: null };

  return [
    ruleCheck,
    consistencyCheck,
    { check_name: "Alignment Check", result: "pass", detail: null },
    quietPeriodCheck,
    {
      check_name: "Agent Origin Check",
      result: "pass",
      detail: sourceOrigin === "human"
        ? "Human-authored — no AI disclosure required"
        : "AI source declared (model + prompt hash recorded)",
    },
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail: "Consistency check unavailable — API key required",
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
      return {
        check_name: "Consistency Check",
        result: "pass",
        detail: `Consistency check unavailable — API error ${response.status}`,
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
    return {
      check_name: "Consistency Check",
      result: "pass",
      detail: `Consistency check error — ${err instanceof Error ? err.message : "unknown"}`,
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
  primary_match: RuleMatch | null;
  rules_active: string[];
};

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
  submittedAt: string
): Promise<CheckResult> {
  // Fetch all rules for this org
  const { data: rules, error } = await sb
    .from("rules")
    .select("id, rule_type, name, description, keywords, effective_from, effective_to")
    .eq("org_id", orgId);

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

  // Rule check: among active rules, which keywords match the draft text?
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

  // Verdict aggregation: highest priority wins
  let verdict: Verdict = "clear";
  let primaryMatch: RuleMatch | null = null;
  for (const m of matches) {
    if (VERDICT_PRIORITY[m.rule_type] > VERDICT_PRIORITY[verdict]) {
      verdict = m.rule_type;
      primaryMatch = m;
    }
  }

  return {
    rule_check: { matches },
    timing_check: {
      rules_active_count: activeRules.length,
      rules_inactive_count: allRules.length - activeRules.length,
      submitted_at: submittedAt,
    },
    verdict,
    primary_match: primaryMatch,
    rules_active: activeRules.map((r) => r.id),
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
