/**
 * Seed two reviewer override decisions for demo purposes.
 *
 * Picks 2 currently-blocked drafts, inserts a reviewer_decided action with
 * decision='override' and a structured payload.reason matching the new schema,
 * then flips the drafts' status to 'overridden'.
 *
 * The actions table is append-only (DB trigger refuses UPDATE/DELETE) — we
 * only INSERT here. Dratfts.status can be updated normally.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

  // Find the principal so the reviewer_decided action has a valid actor_id.
  const { data: principal } = await sb
    .from("users").select("id, name").eq("org_id", orgId).eq("role", "principal").single();
  if (!principal) { console.error("FAIL: no principal in org"); process.exit(1); }

  // Pick 2 currently-blocked drafts (skip ones that already have an override).
  const { data: blockedDrafts, error: bdErr } = await sb
    .from("drafts")
    .select("id, draft_text")
    .eq("org_id", orgId)
    .eq("status", "blocked")
    .limit(10);
  if (bdErr || !blockedDrafts || blockedDrafts.length < 2) {
    console.error("FAIL: need at least 2 blocked drafts; have", blockedDrafts?.length || 0);
    process.exit(1);
  }

  const candidates: { id: string; draft_text: string }[] = [];
  for (const d of blockedDrafts) {
    const { data: existing } = await sb
      .from("actions")
      .select("id")
      .eq("draft_id", d.id)
      .eq("action_type", "reviewer_decided")
      .limit(1);
    if (!existing || existing.length === 0) candidates.push(d);
    if (candidates.length === 2) break;
  }
  if (candidates.length < 2) {
    console.error("FAIL: not enough blocked drafts without an existing reviewer decision");
    process.exit(1);
  }

  const reason = {
    basis: "Rule triggered in error — does not apply to this communication",
    verdict_assessment: "System verdict triggered in error",
    note: "CEO confirmed this post was pre-cleared with legal prior to submission.",
  };

  let written = 0;
  for (const draft of candidates) {
    const { error: actErr } = await sb.from("actions").insert({
      org_id: orgId,
      draft_id: draft.id,
      action_type: "reviewer_decided",
      actor_id: principal.id,
      actor_kind: "user",
      payload: {
        decision: "override",
        reason,
        new_status: "overridden",
      },
    });
    if (actErr) {
      console.error(`  FAIL on ${draft.id}: ${actErr.message}`);
      continue;
    }
    // Companion block_overridden action (parity with the live action handler).
    await sb.from("actions").insert({
      org_id: orgId,
      draft_id: draft.id,
      action_type: "block_overridden",
      actor_id: principal.id,
      actor_kind: "user",
      payload: { reason },
    });
    const { error: stErr } = await sb.from("drafts").update({ status: "overridden" }).eq("id", draft.id);
    if (stErr) {
      console.error(`  status update FAIL on ${draft.id}: ${stErr.message}`);
      continue;
    }
    written++;
    console.log(`  ✓ overridden draft ${draft.id.slice(0, 8)}: "${draft.draft_text.slice(0, 60)}..."`);
  }

  console.log(`\nWrote ${written} override(s).`);

  // Confirmation: report current counts.
  const statuses = ["pending", "approved", "escalated", "blocked", "overridden"];
  console.log("\nDRAFT STATUS COUNTS:");
  for (const s of statuses) {
    const { count } = await sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", orgId).eq("status", s);
    console.log(`  ${s}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("FAIL:", err.message || err); process.exit(1); });
