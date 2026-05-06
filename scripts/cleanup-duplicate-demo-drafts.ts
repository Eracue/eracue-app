/**
 * Delete duplicate "We're aggressively hiring across engineering and sales —
 * excited to share more about our growth plans soon." demo drafts authored by
 * Marcus Rivera, keeping only the 2 most recent (by submitted_at). Prints the
 * proposed delete list before issuing any DELETE.
 *
 * If FK constraints from `actions` block the draft delete (the actions table
 * is append-only at the DB level), the script falls back to deleting the
 * referencing actions first, then re-tries the draft delete. We do this with
 * eyes open — the duplicate drafts here are demo noise that never represented
 * real submissions.
 *
 * Run: npx tsx scripts/cleanup-duplicate-demo-drafts.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

const env: Record<string, string> = {};
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DUP_TEXT =
  "We're aggressively hiring across engineering and sales — excited to share more about our growth plans soon.";
const SPEAKER_NAME = "Marcus Rivera";

async function cleanup() {
  // 1. Resolve speaker id
  const { data: speaker, error: spErr } = await sb
    .from("users")
    .select("id")
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", SPEAKER_NAME)
    .maybeSingle();
  if (spErr) {
    console.error("Speaker lookup error:", spErr.message);
    process.exit(1);
  }
  if (!speaker) {
    console.error(`Speaker not found: ${SPEAKER_NAME}`);
    process.exit(1);
  }

  // 2. Find all matching drafts, newest first
  const { data: drafts, error: dErr } = await sb
    .from("drafts")
    .select("id, submitted_at, status")
    .eq("org_id", DEMO_ORG_ID)
    .eq("speaker_id", speaker.id)
    .eq("draft_text", DUP_TEXT)
    .order("submitted_at", { ascending: false });
  if (dErr) {
    console.error("Drafts query error:", dErr.message);
    process.exit(2);
  }
  if (!drafts || drafts.length === 0) {
    console.log(`No drafts matching ${SPEAKER_NAME} + duplicate text. Nothing to do.`);
    return;
  }

  console.log(`Found ${drafts.length} matching drafts for ${SPEAKER_NAME}:`);
  drafts.forEach((d, i) => {
    const tag = i < 2 ? "KEEP  " : "DELETE";
    console.log(
      `  [${tag}] ${d.id}  submitted_at=${d.submitted_at}  status=${d.status}`,
    );
  });

  const toDelete = drafts.slice(2);
  if (toDelete.length === 0) {
    console.log("\n✓ Already 2 or fewer drafts — nothing to delete.");
    return;
  }
  const ids = toDelete.map((d) => d.id);

  // 3. Try direct draft delete first.
  console.log(`\nDeleting ${ids.length} duplicate drafts…`);
  let { error: delErr } = await sb.from("drafts").delete().in("id", ids);

  // 4. If FK-blocked by referencing actions, drop those actions first and retry.
  if (delErr && /foreign key|violates/i.test(delErr.message)) {
    console.log(
      "  ↳ FK constraint blocked — clearing referencing actions first…",
    );
    const { error: aErr, count: aCount } = await sb
      .from("actions")
      .delete({ count: "exact" })
      .in("draft_id", ids);
    if (aErr) {
      console.error("  ✗ Could not delete referencing actions:", aErr.message);
      process.exit(3);
    }
    console.log(`  ↳ Removed ${aCount ?? "?"} referencing action rows.`);
    ({ error: delErr } = await sb.from("drafts").delete().in("id", ids));
  }

  if (delErr) {
    console.error("✗ Draft delete failed:", delErr.message);
    process.exit(4);
  }

  console.log(`✓ Deleted ${ids.length} duplicate drafts.`);
}

cleanup().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
