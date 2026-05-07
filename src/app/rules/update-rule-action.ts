"use server";

import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Partial update for a rule row. Only the keys present on `updates`
 * are touched; everything else stays as-is. The action enforces
 * org_id scoping so a malicious payload can't reach across orgs even
 * if the ruleId is leaked. Used by the inline EditRulePanel on the
 * rules page.
 */
export type RuleUpdates = {
  name?: string;
  description?: string;
  rule_type?: "block" | "escalate" | "review" | "guide";
  keywords?: string[];
  // ISO timestamp string, or null to clear the expiry. Mapped to the
  // `effective_to` DB column (the UI surfaces it as "Expires on").
  effective_to?: string | null;
};

export type SaveRuleResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveRuleUpdates(
  ruleId: string,
  updates: RuleUpdates,
): Promise<SaveRuleResult> {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  // Build the update payload conditionally so undefined keys don't
  // overwrite existing columns with NULL.
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.rule_type !== undefined) patch.rule_type = updates.rule_type;
  if (updates.keywords !== undefined) patch.keywords = updates.keywords;
  if (updates.effective_to !== undefined) patch.effective_to = updates.effective_to;

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await sb
    .from("rules")
    .update(patch)
    .eq("id", ruleId)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
