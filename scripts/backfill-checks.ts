import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runChecks, verdictToStatus } from "../src/lib/checks";

async function main() {
  // Load .env.local
  const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.error("FAIL: missing env vars in .env.local");
    process.exit(1);
  }
  const sb = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Find DEMO_ORG_ID
  const { data: org, error: orgErr } = await sb
    .from("orgs")
    .select("id")
    .eq("name", "ERA CUE Demo Co")
    .single();
  if (orgErr || !org) {
    console.error("FAIL: could not find ERA CUE Demo Co org");
    process.exit(1);
  }
  const orgId = org.id;
  console.log("Found org:", orgId);

  // Fetch all drafts in this org
  const { data: drafts, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, submitted_at, status")
    .eq("org_id", orgId);
  if (dErr) {
    console.error("FAIL fetching drafts:", dErr.message);
    process.exit(1);
  }
  console.log(`Found ${drafts?.length || 0} drafts to inspect.`);

  let backfilled = 0;
  let skippedAlreadyBackfilled = 0;
  let skippedOverridden = 0;
  let statusChanged = 0;
  let statusUnchanged = 0;
  const errors: string[] = [];

  for (const d of drafts || []) {
    // Skip overridden drafts — don't fight reviewer decisions
    if (d.status === "overridden") {
      skippedOverridden++;
      continue;
    }

    // Skip if already backfilled
    const { data: existing } = await sb
      .from("actions")
      .select("id")
      .eq("draft_id", d.id)
      .eq("action_type", "verdict_issued")
      .filter("payload->>backfilled", "eq", "true")
      .limit(1);
    if (existing && existing.length > 0) {
      skippedAlreadyBackfilled++;
      continue;
    }

    // Run the real checks
    let result;
    try {
      result = await runChecks(sb, orgId, d.draft_text, d.submitted_at);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${d.id}: ${msg}`);
      continue;
    }

    // Write rule_check action
    const { error: rcErr } = await sb.from("actions").insert({
      org_id: orgId,
      draft_id: d.id,
      action_type: "check_ran",
      actor_kind: "ai_check",
      payload: {
        check: "rule_check",
        matches: result.rule_check.matches,
        match_count: result.rule_check.matches.length,
        backfilled: true,
      },
      rules_active: result.rules_active,
    });
    if (rcErr) errors.push(`${d.id} rule_check: ${rcErr.message}`);

    // Write timing_check action
    const { error: tcErr } = await sb.from("actions").insert({
      org_id: orgId,
      draft_id: d.id,
      action_type: "check_ran",
      actor_kind: "ai_check",
      payload: {
        check: "timing_check",
        rules_active_count: result.timing_check.rules_active_count,
        rules_inactive_count: result.timing_check.rules_inactive_count,
        submitted_at: result.timing_check.submitted_at,
        backfilled: true,
      },
      rules_active: result.rules_active,
    });
    if (tcErr) errors.push(`${d.id} timing_check: ${tcErr.message}`);

    // Write verdict_issued action
    const { error: vErr } = await sb.from("actions").insert({
      org_id: orgId,
      draft_id: d.id,
      action_type: "verdict_issued",
      actor_kind: "system",
      payload: {
        verdict: result.verdict,
        primary_match: result.primary_match,
        checks_passed: ["rule_check", "timing_check"],
        backfilled: true,
      },
      rules_active: result.rules_active,
    });
    if (vErr) errors.push(`${d.id} verdict: ${vErr.message}`);

    // Update draft.status to match the real verdict
    const newStatus = verdictToStatus(result.verdict);
    if (newStatus !== d.status) {
      const { error: uErr } = await sb.from("drafts").update({ status: newStatus }).eq("id", d.id);
      if (uErr) {
        errors.push(`${d.id} status update: ${uErr.message}`);
      } else {
        statusChanged++;
      }
    } else {
      statusUnchanged++;
    }

    backfilled++;
  }

  console.log("\nBACKFILL SUMMARY:");
  console.log(`  Backfilled: ${backfilled}`);
  console.log(`  Skipped (already backfilled): ${skippedAlreadyBackfilled}`);
  console.log(`  Skipped (reviewer overridden): ${skippedOverridden}`);
  console.log(`  Status changed: ${statusChanged}`);
  console.log(`  Status already correct: ${statusUnchanged}`);
  console.log(`  Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const e of errors.slice(0, 10)) console.log("  " + e);
    if (errors.length > 10) console.log(`  ... and ${errors.length - 10} more`);
  }

  // Final per-status counts in the queue (for verification)
  const statuses = ["pending", "approved", "escalated", "blocked", "overridden"];
  console.log("\nFINAL DRAFT STATUS COUNTS (org-scoped):");
  for (const s of statuses) {
    const { count } = await sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", s);
    console.log(`  ${s}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("FAIL:", err.message || err); process.exit(1); });
