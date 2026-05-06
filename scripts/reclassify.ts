import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { runChecks, verdictToStatus } from "../src/lib/checks";

async function main() {
  const envContent = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const env: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: org } = await sb.from("orgs").select("id").eq("name", "ERA CUE Demo Co").single();
  if (!org) { console.error("FAIL: no demo org"); process.exit(1); }
  const orgId = org.id;

  // Step 1: expand Series B Quiet Period keywords
  console.log("Step 1: expanding Series B Quiet Period keywords...");
  const { data: rule } = await sb.from("rules").select("id, keywords").eq("org_id", orgId).eq("name", "Series B Quiet Period").single();
  if (!rule) { console.error("FAIL: no Series B rule"); process.exit(1); }
  const newKeywords = Array.from(new Set([
    ...(rule.keywords || []),
    "raised",
    "closed our",
    "round",
    "term sheet",
    "valuation",
  ]));
  await sb.from("rules").update({ keywords: newKeywords }).eq("id", rule.id);
  console.log("  Updated keywords:", newKeywords);

  // Step 2: reclassify all drafts (except overridden)
  console.log("\nStep 2: reclassifying drafts...");
  const { data: drafts } = await sb.from("drafts").select("id, draft_text, submitted_at, status").eq("org_id", orgId);
  let changed = 0;
  let unchanged = 0;
  let skippedOverridden = 0;
  const changes: { id: string; old: string; new: string; text: string }[] = [];

  for (const d of drafts || []) {
    if (d.status === "overridden") { skippedOverridden++; continue; }
    const result = await runChecks(sb, orgId, d.draft_text, d.submitted_at);
    const newStatus = verdictToStatus(result.verdict);

    if (newStatus !== d.status) {
      // Write a fresh verdict_issued action — audit-honest about the reclassification
      await sb.from("actions").insert({
        org_id: orgId,
        draft_id: d.id,
        action_type: "verdict_issued",
        actor_kind: "system",
        payload: {
          verdict: result.verdict,
          primary_match: result.primary_match,
          checks_passed: ["rule_check", "timing_check"],
          reclassified: true,
          previous_status: d.status,
        },
        rules_active: result.rules_active,
      });
      await sb.from("drafts").update({ status: newStatus }).eq("id", d.id);
      changed++;
      changes.push({ id: d.id, old: d.status, new: newStatus, text: d.draft_text.slice(0, 60) });
    } else {
      unchanged++;
    }
  }

  console.log(`  Changed: ${changed}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Skipped (overridden): ${skippedOverridden}`);

  if (changes.length > 0) {
    console.log("\nReclassifications:");
    for (const c of changes) console.log(`  ${c.old} → ${c.new}: "${c.text}..."`);
  }

  // Step 3: report final per-status counts
  const statuses = ["pending", "approved", "escalated", "blocked", "overridden"];
  console.log("\nFINAL STATUS COUNTS:");
  for (const s of statuses) {
    const { count } = await sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", s);
    console.log(`  ${s}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("FAIL:", err.message); process.exit(1); });
