/**
 * Three-step test-data cleanup. Prints what will be deleted before deleting.
 *
 *   1. Delete the rule named "Custom Communication Rule" (heuristic stub artifact).
 *   2. Delete drafts whose draft_text is exactly "hiring" (single-word test).
 *   3. Delete duplicate drafts: where the same (speaker_id, draft_text) pair
 *      appears more than twice, keep the two most recent and delete the rest.
 *
 * Caveat: the actions table is append-only at the database level (UPDATE/DELETE
 * are rejected by trigger). Drafts have a NOT NULL FK from actions.draft_id,
 * so deleting a draft that has any actions will fail with an FK constraint
 * violation. The script reports those failures explicitly rather than papering
 * over them — most demo drafts have at least a `submitted` action and cannot
 * be physically removed without first allowing CASCADE on actions.draft_id.
 *
 * Run: npx tsx scripts/cleanup-test-data.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function getSupabaseAdmin(): SupabaseClient {
  const env = loadEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type DraftRow = {
  id: string;
  draft_text: string;
  submitted_at: string;
  speaker_id: string;
  users: { name: string } | null;
};

async function step1RuleDelete(sb: SupabaseClient) {
  console.log("─── Step 1: delete 'Custom Communication Rule' ───");
  const { data: preview, error: pErr } = await sb
    .from("rules")
    .select("id, name, rule_type, created_at")
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Custom Communication Rule");
  if (pErr) { console.error("  preview FAIL:", pErr.message); return; }
  if (!preview || preview.length === 0) {
    console.log("  (no matching rule found — already cleaned)");
    return;
  }
  console.log(`  Will delete ${preview.length} rule(s):`);
  for (const r of preview) console.log(`    ${r.id.slice(0, 8)}  type=${r.rule_type}  ${r.name}`);
  const { error, count } = await sb
    .from("rules")
    .delete({ count: "exact" })
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Custom Communication Rule");
  if (error) { console.error("  delete FAIL:", error.message); return; }
  console.log(`  ✓ Deleted ${count ?? "?"} rule(s).`);
}

async function attemptDeleteDraft(sb: SupabaseClient, id: string): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await sb.from("drafts").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

async function step2HiringDrafts(sb: SupabaseClient) {
  console.log("\n─── Step 2: delete drafts where draft_text = 'hiring' ───");
  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, submitted_at, speaker_id, users:speaker_id(name)")
    .eq("org_id", DEMO_ORG_ID)
    .eq("draft_text", "hiring");
  if (error) { console.error("  preview FAIL:", error.message); return; }
  const drafts = (data || []) as unknown as DraftRow[];
  if (drafts.length === 0) {
    console.log("  (no matching drafts)");
    return;
  }
  console.log(`  Will attempt to delete ${drafts.length} draft(s):`);
  for (const d of drafts) {
    console.log(`    ${d.id.slice(0, 8)}  speaker=${d.users?.name ?? "—"}  submitted=${d.submitted_at}`);
  }
  let deleted = 0;
  const blocked: { id: string; reason: string }[] = [];
  for (const d of drafts) {
    const r = await attemptDeleteDraft(sb, d.id);
    if (r.ok) deleted++;
    else blocked.push({ id: d.id, reason: r.reason ?? "unknown" });
  }
  console.log(`  ✓ Deleted ${deleted}.  Blocked ${blocked.length}.`);
  for (const b of blocked) console.log(`    ✗ ${b.id.slice(0, 8)}: ${b.reason}`);
}

async function step3Duplicates(sb: SupabaseClient) {
  console.log("\n─── Step 3: delete duplicates beyond the two most recent ───");
  const { data, error } = await sb
    .from("drafts")
    .select("id, draft_text, submitted_at, speaker_id, users:speaker_id(name)")
    .eq("org_id", DEMO_ORG_ID)
    .order("submitted_at", { ascending: false });
  if (error) { console.error("  preview FAIL:", error.message); return; }
  const drafts = (data || []) as unknown as DraftRow[];

  // Group by (speaker_id, draft_text). Drafts are already sorted DESC by
  // submitted_at, so within each group the first two entries are the two most
  // recent — keep those, mark the rest for deletion.
  const groups = new Map<string, DraftRow[]>();
  for (const d of drafts) {
    const key = `${d.speaker_id}::${d.draft_text}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const toDelete: DraftRow[] = [];
  for (const [, group] of groups) {
    if (group.length > 2) toDelete.push(...group.slice(2));
  }

  if (toDelete.length === 0) {
    console.log("  (no duplicates beyond 2-most-recent)");
    return;
  }
  console.log(`  Will attempt to delete ${toDelete.length} duplicate draft(s):`);
  // Group preview by speaker for readability.
  const previewBySpeaker = new Map<string, DraftRow[]>();
  for (const d of toDelete) {
    const k = d.users?.name ?? "—";
    if (!previewBySpeaker.has(k)) previewBySpeaker.set(k, []);
    previewBySpeaker.get(k)!.push(d);
  }
  for (const [name, rows] of previewBySpeaker) {
    console.log(`    ${name}: ${rows.length} drafts`);
    for (const r of rows.slice(0, 3)) {
      const snippet = r.draft_text.slice(0, 60).replace(/\n/g, " ");
      console.log(`      ${r.id.slice(0, 8)}  ${r.submitted_at}  "${snippet}…"`);
    }
    if (rows.length > 3) console.log(`      … and ${rows.length - 3} more`);
  }

  let deleted = 0;
  const blocked: { id: string; reason: string }[] = [];
  for (const d of toDelete) {
    const r = await attemptDeleteDraft(sb, d.id);
    if (r.ok) deleted++;
    else blocked.push({ id: d.id, reason: r.reason ?? "unknown" });
  }
  console.log(`  ✓ Deleted ${deleted}.  Blocked ${blocked.length}.`);
  if (blocked.length > 0) {
    console.log(`    First few blocked reasons (likely FK from actions.draft_id):`);
    for (const b of blocked.slice(0, 3)) console.log(`      ✗ ${b.id.slice(0, 8)}: ${b.reason}`);
  }
}

async function main() {
  const sb = getSupabaseAdmin();
  await step1RuleDelete(sb);
  await step2HiringDrafts(sb);
  await step3Duplicates(sb);
  console.log("\n─── Done.");
}

main().catch((e) => {
  console.error("FAIL:", e?.message ?? e);
  process.exit(1);
});
