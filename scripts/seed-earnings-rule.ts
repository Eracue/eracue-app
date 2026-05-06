import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { DEMO_ORG_ID } from "../src/lib/demo-config";

// Load .env.local manually so this script doesn't depend on dotenv being
// installed. Format: KEY=value, ignores blank/comment lines.
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

async function seed() {
  // Idempotent — re-running this script is a no-op if the rule already exists.
  const { data: existing } = await sb
    .from("rules")
    .select("id")
    .eq("org_id", DEMO_ORG_ID)
    .eq("name", "Earnings Quiet Period — Q2 2026")
    .maybeSingle();

  if (existing) {
    console.log("Rule already exists. Done.");
    return;
  }

  // The rules table has no `regulatory_basis` column today, so the
  // regulatory framing is appended to the description itself. This
  // keeps the citation visible on the rule card without a schema change.
  const { error } = await sb.from("rules").insert({
    org_id: DEMO_ORG_ID,
    name: "Earnings Quiet Period — Q2 2026",
    rule_type: "block",
    description:
      "No forward guidance, financial projections, or material information disclosure during earnings quiet period. Applies to all public communications. Regulatory basis: Reg FD · FINRA Rule 2210 · SEC Rule 10b-5.",
    keywords: [
      "revenue",
      "guidance",
      "outlook",
      "expects",
      "projects",
      "anticipates",
      "forecast",
      "earnings",
      "results",
      "quarterly",
      "growth rate",
      "margin",
      "beat",
      "miss",
      "raise guidance",
    ],
    scope: "all_speakers",
    rule_status: "active",
    effective_from: "2026-05-01T00:00:00Z",
    effective_to: "2026-08-15T00:00:00Z",
    wsp_reference: "Section 7.4 — Earnings Communications Policy",
  });

  if (error) {
    console.error("Error:", error.message);
    return;
  }

  console.log("✓ Earnings Quiet Period rule added.");
}

seed().catch(console.error);
