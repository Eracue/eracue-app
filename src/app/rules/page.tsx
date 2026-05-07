import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";
import { RulesClient, type RuleRow } from "./rules-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Shape returned by the rules SELECT — uses PostgREST aliases to surface
// `verdict` and `effective_until` (the DB columns are `rule_type` and
// `effective_to`).
type RawRuleRow = {
  id: string;
  name: string;
  description: string | null;
  verdict: string;
  keywords: string[] | null;
  effective_from: string | null;
  effective_until: string | null;
  scope: string | null;
  rule_status: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  wsp_reference: string | null;
};

type VerdictAction = {
  occurred_at: string;
  payload: { primary_match?: { rule_id?: string; rule_name?: string } | null };
};

async function getRulesData(): Promise<{ rules: RuleRow[]; corpusCount: number }> {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  const [rulesRes, actionsRes, corpusRes] = await Promise.all([
    sb
      .from("rules")
      // PostgREST aliases:  alias_name:column_name. Surface DB columns under
      // the friendly names the UI uses.
      .select(
        "id, name, description, keywords, scope, rule_status, deactivated_at, deactivated_reason, wsp_reference, verdict:rule_type, effective_from, effective_until:effective_to"
      )
      .eq("org_id", orgId)
      .order("name"),
    sb
      .from("actions")
      .select("occurred_at, payload")
      .eq("org_id", orgId)
      .eq("action_type", "verdict_issued"),
    // Approved-draft count drives the Consistency Check status line
    // ("comparing against N approved statements"). head:true skips the
    // payload — we only need the count header.
    sb
      .from("drafts")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "approved"),
  ]);

  if (rulesRes.error) throw new Error("rules: " + rulesRes.error.message);
  if (actionsRes.error) throw new Error("verdicts: " + actionsRes.error.message);
  if (corpusRes.error) throw new Error("corpus: " + corpusRes.error.message);

  const rules = (rulesRes.data || []) as unknown as RawRuleRow[];
  const verdicts = (actionsRes.data || []) as VerdictAction[];

  // Compute trigger_count and last_triggered per rule by joining in JS on
  // payload.primary_match.rule_name. (rule_id would be more reliable but the
  // existing seed/backfill data also matches by name.)
  const rulesWithCounts: RuleRow[] = rules.map((r) => {
    let count = 0;
    let last: string | null = null;
    for (const v of verdicts) {
      const pm = v.payload?.primary_match;
      if (!pm) continue;
      if (pm.rule_name === r.name) {
        count++;
        if (!last || v.occurred_at > last) last = v.occurred_at;
      }
    }
    return {
      ...r,
      trigger_count: count,
      last_triggered: last,
    };
  });

  return { rules: rulesWithCounts, corpusCount: corpusRes.count ?? 0 };
}

export default async function RulesPage() {
  const { rules, corpusCount } = await getRulesData();
  return (
    <>
      <SiteHeader />
      <RulesClient rules={rules} corpusCount={corpusCount} />
    </>
  );
}
