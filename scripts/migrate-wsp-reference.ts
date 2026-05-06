/**
 * Migration: add `wsp_reference` column to `rules` (links rule to firm's
 * Written Supervisory Procedures, surfaced in rule cards and the examiner
 * record for FINRA examination purposes).
 *
 * Run: npx tsx scripts/migrate-wsp-reference.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const SQL = `ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS wsp_reference TEXT;`;

async function migrate() {
  console.log("Probing rules.wsp_reference …");

  const { error: testErr } = await sb.from("rules").select("wsp_reference").limit(1);
  if (!testErr) {
    console.log("✓ Column already exists. Nothing to do.");
    return;
  }

  console.log("✗ Column not present. Attempting DDL via exec_sql RPC …");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (sb as any).rpc("exec_sql", { sql: SQL });
  if (rpcErr) {
    console.log("⚠ exec_sql RPC unavailable. Paste this SQL into Supabase SQL editor:\n");
    console.log("--- BEGIN SQL ---");
    console.log(SQL);
    console.log("--- END SQL ---\n");
    console.log("Then re-run: npx tsx scripts/migrate-wsp-reference.ts");
    process.exit(2);
  }

  console.log("✓ Column added via exec_sql.");
}

migrate().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
