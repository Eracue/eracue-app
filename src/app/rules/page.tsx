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
  draft_id: string;
  occurred_at: string;
  payload: { primary_match?: { rule_id?: string; rule_name?: string } | null };
};

async function getRulesData(): Promise<{
  rules: RuleRow[];
  corpusCount: number;
  firmType: string | null;
  corpusEarliest: string | null;
  corpusLatest: string | null;
}> {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  const [
    rulesRes,
    actionsRes,
    corpusRes,
    orgRes,
    draftStatusRes,
    corpusEarliestRes,
    corpusLatestRes,
  ] = await Promise.all([
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
      .select("draft_id, occurred_at, payload")
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
    // firm_type drives which Templates the import panel shows. Wrapped in
    // its own query (not a join on rules) because rules can outlive the
    // firm_type that authored them.
    sb.from("orgs").select("firm_type").eq("id", orgId).maybeSingle(),
    // draft_id → status lookup so the per-rule effectiveness_score can
    // tell which of a rule's matched drafts ended up overridden. Mirrors
    // the dashboard's rules-perf computation.
    sb.from("drafts").select("id, status").eq("org_id", orgId),
    // Earliest/latest approved-draft submitted_at — drives the
    // Governance Memory date-range readout. We sort and limit(1) so
    // the wire payload is one row.
    sb
      .from("drafts")
      .select("submitted_at")
      .eq("org_id", orgId)
      .eq("status", "approved")
      .order("submitted_at", { ascending: true })
      .limit(1),
    sb
      .from("drafts")
      .select("submitted_at")
      .eq("org_id", orgId)
      .eq("status", "approved")
      .order("submitted_at", { ascending: false })
      .limit(1),
  ]);

  if (rulesRes.error) throw new Error("rules: " + rulesRes.error.message);
  if (actionsRes.error) throw new Error("verdicts: " + actionsRes.error.message);
  if (corpusRes.error) throw new Error("corpus: " + corpusRes.error.message);
  // orgRes errors are tolerated — firmType just falls back to null and
  // the panel uses the default broker_dealer template set.

  const rules = (rulesRes.data || []) as unknown as RawRuleRow[];
  const verdicts = (actionsRes.data || []) as VerdictAction[];

  const draftStatusById = new Map<string, string>();
  for (const d of (draftStatusRes.data ?? []) as Array<{ id: string; status: string }>) {
    draftStatusById.set(d.id, d.status);
  }

  // Compute trigger_count, last_triggered, and effectiveness_score per
  // rule. effectiveness_score = (matches − overrides) / matches × 100,
  // null when the rule has never matched a draft.
  const rulesWithCounts: RuleRow[] = rules.map((r) => {
    let count = 0;
    let overrideCount = 0;
    let last: string | null = null;
    for (const v of verdicts) {
      const pm = v.payload?.primary_match;
      if (!pm) continue;
      if (pm.rule_name === r.name || (pm.rule_id && pm.rule_id === r.id)) {
        count++;
        if (!last || v.occurred_at > last) last = v.occurred_at;
        if (draftStatusById.get(v.draft_id) === "overridden") overrideCount++;
      }
    }
    const effectiveness_score =
      count > 0 ? Math.round(((count - overrideCount) / count) * 100) : null;
    return {
      ...r,
      trigger_count: count,
      last_triggered: last,
      effectiveness_score,
    };
  });

  const firmType =
    (orgRes.data as { firm_type?: string | null } | null)?.firm_type ?? null;

  const earliestRow = (corpusEarliestRes.data ?? [])[0] as
    | { submitted_at: string | null }
    | undefined;
  const latestRow = (corpusLatestRes.data ?? [])[0] as
    | { submitted_at: string | null }
    | undefined;

  return {
    rules: rulesWithCounts,
    corpusCount: corpusRes.count ?? 0,
    firmType,
    corpusEarliest: earliestRow?.submitted_at ?? null,
    corpusLatest: latestRow?.submitted_at ?? null,
  };
}

export default async function RulesPage() {
  const { rules, corpusCount, firmType, corpusEarliest, corpusLatest } =
    await getRulesData();
  return (
    <>
      <SiteHeader />
      <RulesClient
        rules={rules}
        corpusCount={corpusCount}
        firmType={firmType}
        corpusEarliest={corpusEarliest}
        corpusLatest={corpusLatest}
      />
    </>
  );
}
