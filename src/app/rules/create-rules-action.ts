"use server";

import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Wire-format for a candidate rule coming back from the import panel
 * (templates, paste, upload, manual). `source` is kept on the wire so
 * the panel can attribute provenance, but is NOT written to the DB —
 * the rules table doesn't have a `source` column. Same goes for
 * `regulatory_basis`: it's appended into `description` (the existing
 * pattern across seed-earnings-rule.ts and scripts/fix-rules.ts) so
 * the citation stays visible on the rule card without a schema change.
 */
export type CandidateRuleInput = {
  name: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  description: string;
  keywords: string[];
  wsp_reference: string;
  regulatory_basis: string;
  source: string;
};

export type CreateRulesResult =
  | { ok: true; inserted: number }
  | { ok: false; error: string };

/**
 * Persist the user-curated subset of imported rules. Each becomes an
 * active rule in the caller's org effective immediately, with no end
 * date. Re-running with overlapping rule names will produce duplicates
 * — name uniqueness is intentionally NOT enforced because the rules
 * page allows multiple iterations of the same conceptual rule across
 * effective windows.
 */
export async function createRulesFromImport(
  rules: CandidateRuleInput[],
): Promise<CreateRulesResult> {
  if (rules.length === 0) return { ok: false, error: "No rules selected." };

  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();
  const now = new Date().toISOString();

  const rows = rules.map((r) => {
    const trimmedBasis = r.regulatory_basis?.trim() ?? "";
    const description = trimmedBasis
      ? `${r.description} Regulatory basis: ${trimmedBasis}.`
      : r.description;
    const trimmedWsp = r.wsp_reference?.trim() ?? "";
    return {
      org_id: orgId,
      name: r.name,
      rule_type: r.rule_type,
      description,
      keywords: r.keywords,
      scope: "all_speakers",
      rule_status: "active",
      effective_from: now,
      effective_to: null,
      ...(trimmedWsp ? { wsp_reference: trimmedWsp } : {}),
    };
  });

  const { error } = await sb.from("rules").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, inserted: rows.length };
}
