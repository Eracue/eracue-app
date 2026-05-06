/**
 * Migration: add three FINRA Rule 2210 classification columns to `drafts` and
 * seed all existing rows with appropriate values.
 *
 * Columns added (idempotent — uses IF NOT EXISTS):
 *   communication_category: 'retail' | 'institutional' | 'correspondence'
 *   content_type:           'static' | 'interactive'
 *   intended_audience:      'public' | 'limited' | 'institutional'
 *
 * Defaults applied to all 34 existing drafts:
 *   retail / static / public
 * Override for channels in (email, interview):
 *   correspondence / static / limited
 *
 * The Supabase JS client cannot run DDL (ALTER TABLE) through .rpc unless a
 * matching `exec_sql` function is defined in the database. This script
 * attempts the rpc and falls back to printing the SQL the user must paste
 * into the Supabase SQL editor manually. Either path leaves the seeding
 * step (UPDATE statements via .from().update()) safe to run unconditionally.
 *
 * Run with: npx tsx scripts/migrate-add-communication-fields.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const ALTER_SQL = `ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS communication_category TEXT
    DEFAULT 'retail'
    CHECK (communication_category IN ('retail','institutional','correspondence')),
  ADD COLUMN IF NOT EXISTS content_type TEXT
    DEFAULT 'static'
    CHECK (content_type IN ('static','interactive')),
  ADD COLUMN IF NOT EXISTS intended_audience TEXT
    DEFAULT 'public'
    CHECK (intended_audience IN ('public','limited','institutional'));`;

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

async function tryAlter(sb: SupabaseClient): Promise<boolean> {
  // Try the conventional `exec_sql` rpc first — many Supabase setups expose it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).rpc("exec_sql", { sql: ALTER_SQL });
  if (!error) return true;
  console.warn("rpc('exec_sql') unavailable:", error.message);
  return false;
}

async function columnsExist(sb: SupabaseClient): Promise<boolean> {
  // Probe by selecting the column. If it doesn't exist, Postgres errors out.
  const { error } = await sb.from("drafts").select("id, communication_category").limit(1);
  return !error;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve org
  const { data: org, error: orgErr } = await sb
    .from("orgs").select("id").eq("name", "ERA CUE Demo Co").single();
  if (orgErr || !org) { console.error("FAIL: no demo org"); process.exit(1); }
  const orgId = org.id;

  // STEP 1 — DDL
  console.log("Step 1: checking if columns exist...");
  let alreadyExists = await columnsExist(sb);
  if (alreadyExists) {
    console.log("  Columns already present — skipping ALTER.");
  } else {
    console.log("  Columns missing — attempting ALTER via rpc('exec_sql')...");
    const ok = await tryAlter(sb);
    if (!ok) {
      console.error("\nFAIL: cannot run DDL through the Supabase JS client.");
      console.error("Please paste the following SQL into the Supabase SQL editor and re-run this script:\n");
      console.error("--- BEGIN SQL ---");
      console.error(ALTER_SQL);
      console.error("--- END SQL ---\n");
      process.exit(2);
    }
    alreadyExists = await columnsExist(sb);
    if (!alreadyExists) {
      console.error("FAIL: ALTER appeared to succeed but columns still not visible.");
      process.exit(3);
    }
    console.log("  Columns added successfully.");
  }

  // STEP 2 — Seed values
  console.log("\nStep 2: seeding existing drafts...");

  // Default fill for everyone — retail / static / public
  const { error: defErr, count: defCount } = await sb
    .from("drafts")
    .update({
      communication_category: "retail",
      content_type: "static",
      intended_audience: "public",
    }, { count: "exact" })
    .eq("org_id", orgId);
  if (defErr) { console.error("default seed FAIL:", defErr.message); process.exit(4); }
  console.log(`  Defaulted ${defCount ?? "?"} drafts to retail/static/public.`);

  // Override for email + interview → correspondence / static / limited
  const { error: corrErr, count: corrCount } = await sb
    .from("drafts")
    .update({
      communication_category: "correspondence",
      content_type: "static",
      intended_audience: "limited",
    }, { count: "exact" })
    .eq("org_id", orgId)
    .in("channel", ["email", "interview"]);
  if (corrErr) { console.error("correspondence seed FAIL:", corrErr.message); process.exit(5); }
  console.log(`  Reclassified ${corrCount ?? "?"} email/interview drafts to correspondence/static/limited.`);

  // STEP 3 — Verify
  console.log("\nStep 3: count by communication_category");
  for (const cat of ["retail", "institutional", "correspondence"]) {
    const { count } = await sb
      .from("drafts")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("communication_category", cat);
    console.log(`  ${cat}: ${count ?? 0}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
