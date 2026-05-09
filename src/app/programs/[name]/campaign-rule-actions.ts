"use server";

import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";

// ---- campaign_rules CRUD --------------------------------------------------
//
// `campaign_rules` is a per-campaign rule allowlist. Schema (Supabase):
//   id          uuid PK
//   campaign_id uuid → campaigns.id
//   rule_id     uuid → rules.id
//   created_at  timestamp
//
// Convention: row presence == rule is ON for that campaign.
// When the table has zero rows for a given campaign_id, the campaign
// is in *implicit-all* mode — every active rule applies. The first
// time a rule is toggled OFF, the remove action materialises rows for
// every other active rule so the unchecked state survives a reload.
//
// Both actions return the same { ok: true } | { ok: false; error }
// shape used by the rest of the rules surface; the client thread its
// errors through the inline section's busy/error states.

type Result = { ok: true } | { ok: false; error: string };

export async function addRuleToCampaignAction(
  campaignId: string,
  ruleId: string,
): Promise<Result> {
  try {
    const sb = getSupabaseAdmin();
    // org isolation is enforced at the DB layer via the campaign FK +
    // RLS; we don't filter by org_id here because campaign_rules has
    // no org_id column.
    void (await resolveOrgId());

    // Idempotent insert. If the row already exists (unique violation
    // on the (campaign_id, rule_id) pair) the desired end state is
    // already satisfied, so we treat 23505 as success rather than
    // surfacing a confusing error to the toggle UI. If the schema
    // doesn't carry the unique constraint, double-clicks could leave
    // duplicate rows — the count display still rounds those down via
    // the deduped Set on the client.
    const { error } = await sb
      .from("campaign_rules")
      .insert({ campaign_id: campaignId, rule_id: ruleId });
    if (error) {
      if (error.code === "23505") return { ok: true };
      console.error(
        "addRuleToCampaignAction DB error:",
        JSON.stringify(error),
      );
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("addRuleToCampaignAction caught:", message);
    return { ok: false, error: message };
  }
}

export async function removeRuleFromCampaignAction(
  campaignId: string,
  ruleId: string,
): Promise<Result> {
  try {
    const sb = getSupabaseAdmin();
    const orgId = await resolveOrgId();

    // Materialise-on-first-toggle-off: when the campaign is currently
    // in implicit-all mode (zero rows), turning ONE rule off needs to
    // record that ALL OTHER active rules are still ON — otherwise the
    // empty-table state would still read as "everything applies".
    const { count } = await sb
      .from("campaign_rules")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    if ((count ?? 0) === 0) {
      const { data: activeRules, error: rulesErr } = await sb
        .from("rules")
        .select("id")
        .eq("org_id", orgId)
        .eq("rule_status", "active")
        .neq("id", ruleId);
      if (rulesErr) {
        console.error(
          "removeRuleFromCampaignAction (materialise fetch) DB error:",
          JSON.stringify(rulesErr),
        );
        return { ok: false, error: rulesErr.message };
      }
      const rows = ((activeRules ?? []) as Array<{ id: string }>).map((r) => ({
        campaign_id: campaignId,
        rule_id: r.id,
      }));
      if (rows.length > 0) {
        const { error: insErr } = await sb
          .from("campaign_rules")
          .insert(rows);
        if (insErr) {
          console.error(
            "removeRuleFromCampaignAction (materialise insert) DB error:",
            JSON.stringify(insErr),
          );
          return { ok: false, error: insErr.message };
        }
      }
      return { ok: true };
    }

    // Standard path — explicit-state campaign, just drop the row.
    const { error: delErr } = await sb
      .from("campaign_rules")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("rule_id", ruleId);
    if (delErr) {
      console.error(
        "removeRuleFromCampaignAction DB error:",
        JSON.stringify(delErr),
      );
      return { ok: false, error: delErr.message };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("removeRuleFromCampaignAction caught:", message);
    return { ok: false, error: message };
  }
}
