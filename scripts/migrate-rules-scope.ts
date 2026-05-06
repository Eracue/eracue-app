/**
 * Migration: add `scope`, `rule_status`, `deactivated_at`, `deactivated_reason`
 * columns to `rules` and seed all existing rules with defaults.
 *
 * If `exec_sql` rpc isn't exposed (typical Supabase project), prints the SQL
 * for manual paste. Step 2 (seeding) is idempotent — re-run after the SQL is
 * applied to fill values.
 *
 * Run: npx tsx scripts/migrate-rules-scope.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

// Inline a minimal .env.local loader because getSupabaseAdmin reads
// process.env, which isn't auto-populated outside Next.js.
function loadEnv() {
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
function getSupabaseAdmin() {
  const env = loadEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const SQL = `ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS scope TEXT
    DEFAULT 'all_speakers',
  ADD COLUMN IF NOT EXISTS rule_status TEXT
    DEFAULT 'active'
    CHECK (rule_status IN ('active','deactivated','expired')),
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_reason TEXT;`;

async function migrate() {
  const sb = getSupabaseAdmin();

  // Step 1 — DDL via exec_sql rpc (most projects don't expose this).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (sb as any).rpc("exec_sql", { sql: SQL });
  if (rpcErr) {
    console.log("⚠ DDL via RPC not available — please paste this SQL into the Supabase SQL editor:\n");
    console.log("--- BEGIN SQL ---");
    console.log(SQL);
    console.log("--- END SQL ---\n");
    console.log("Then re-run this script to complete seeding.\n");
  } else {
    console.log("✓ Columns added");
  }

  // Step 2 — Seed defaults. Idempotent: succeeds either way once columns exist.
  const { error: seedErr, count } = await sb
    .from("rules")
    .update({ scope: "all_speakers", rule_status: "active" }, { count: "exact" })
    .eq("org_id", DEMO_ORG_ID);
  if (seedErr) {
    console.error("Seed error:", seedErr.message);
    console.error("(This is expected if columns don't exist yet — apply the SQL and re-run.)");
    process.exit(2);
  }
  console.log(`✓ Seeded ${count ?? "?"} rules → scope=all_speakers, rule_status=active`);

  // Step 3 — Verify by listing rule scope/status.
  const { data, error: vErr } = await sb
    .from("rules")
    .select("name, scope, rule_status")
    .eq("org_id", DEMO_ORG_ID)
    .order("name");
  if (vErr) { console.error("Verify error:", vErr.message); process.exit(3); }
  console.log("\nRules after migration:");
  for (const r of data || []) console.log(`  ${r.name.padEnd(28)} scope=${r.scope}  rule_status=${r.rule_status}`);
  process.exit(0);
}

migrate().catch((e) => { console.error("FAIL:", e.message || e); process.exit(1); });
