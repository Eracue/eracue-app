/**
 * One-shot cleanup: delete the placeholder "Custom Communication Rule" the
 * heuristic stub draft creates when ANTHROPIC_API_KEY isn't configured. The
 * stub returned this name with empty keywords for any non-matching demo
 * description; it shouldn't persist in the rules list.
 *
 * Run: npx tsx scripts/delete-stub-rule.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

const env: Record<string, string> = {};
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

async function main() {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error, count } = await sb
    .from("rules")
    .delete({ count: "exact" })
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Custom Communication Rule")
    .select("id, name");

  if (error) {
    console.error("FAIL:", error.message);
    process.exit(1);
  }
  console.log(`Deleted ${count ?? data?.length ?? 0} rule(s) named "Custom Communication Rule".`);
}

main().catch((e) => { console.error(e); process.exit(1); });
