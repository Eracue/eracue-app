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
