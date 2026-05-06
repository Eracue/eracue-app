/**
 * Diagnostic: list every rule in the demo org by `created_at` descending so
 * we can spot rules that were added after the original 6-rule seed.
 *
 * Run: npx tsx scripts/list-rules-by-creation.ts
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

async function listRules() {
  const { data, error } = await sb
    .from("rules")
    .select("id, name, rule_type, created_at")
    .eq("org_id", DEMO_ORG_ID)
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const rules = data || [];
  console.log(`Found ${rules.length} rules in the demo org (newest first):\n`);
  for (const r of rules) {
    console.log(
      `  ${r.created_at}  ${(r.rule_type || "?").padEnd(9)}  ${r.name}  (${(r.id as string).slice(0, 8)}…)`,
    );
  }
}

listRules().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
