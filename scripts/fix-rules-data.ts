/**
 * One-off data fix for the demo org's rules.
 *
 *   1. Competitor Mentions — keywords were too generic (single-word
 *      "competitor" / "rival" produced false-positive matches on
 *      neutral mentions). Replaced with targeted phrases that fire
 *      only on actual comparative claims.
 *   2. Pricing Claims — same problem. Bare "price"/"pricing" matched
 *      legitimate product copy. Replaced with superlative phrases.
 *
 * Idempotent — safe to re-run; UPDATE just rewrites the keywords array.
 *
 * Run:  npx tsx scripts/fix-rules-data.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

// Load .env.local manually so this script doesn't depend on dotenv.
const env: Record<string, string> = {};
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fix() {
  // Fix Competitor Mentions keywords
  const { error: e1 } = await sb
    .from("rules")
    .update({
      keywords: [
        "our competitor",
        "unlike competitors",
        "better than any competitor",
        "no competitor can",
        "competitors cannot",
        "outperforms every competitor",
      ],
    })
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Competitor Mentions");

  console.log(
    e1 ? `✗ Competitor Mentions: ${e1.message}` : "✓ Competitor Mentions keywords fixed",
  );

  // Fix Pricing Claims keywords
  const { error: e2 } = await sb
    .from("rules")
    .update({
      keywords: [
        "lowest price",
        "best price in the market",
        "most affordable option",
        "cheapest in the industry",
        "industry-leading price",
        "unbeatable pricing",
      ],
    })
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Pricing Claims");

  console.log(
    e2 ? `✗ Pricing Claims: ${e2.message}` : "✓ Pricing Claims keywords fixed",
  );

  console.log("Done.");
}

fix().catch(console.error);
