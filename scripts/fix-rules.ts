/**
 * Tighten the demo rule set so the keyword-only Stage 1 produces fewer
 * false positives, and add the FINRA 2210 rules the examiner record now
 * expects to find. Idempotent — re-running this script:
 *   • re-applies the canonical keyword lists for the rules it touches
 *   • upserts the three new rules by name (no duplicates)
 *
 * Run: npx tsx scripts/fix-rules.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

const sb: SupabaseClient = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- Existing-rule keyword tightening -------------------------------

type RuleUpdate = {
  name: string;
  // null/undefined means "leave keywords alone" — currently only used as a
  // sentinel for Series B Quiet Period (its keywords are correct as-is).
  keywords?: string[];
  note: string;
};

const RULE_UPDATES: RuleUpdate[] = [
  {
    name: "Series B Quiet Period",
    note: "Keep existing keywords — appropriate for a quiet period rule",
  },
  {
    name: "Enterprise Sales Claims",
    // Drop bare verbs like "signed" / "closed deal" that match anything; keep
    // specific customer-count claims that actually trigger the rule's intent.
    keywords: [
      "fortune 500 customer",
      "enterprise customer",
      "signed X customers",
      "X clients",
    ],
    note: "Removed overly broad verbs; kept specific customer-count claims",
  },
  {
    name: "Pricing Claims",
    // Drop "pricing" alone — too broad, fires on legitimate product pages.
    // Replace with superlative price claims that are the actual concern.
    keywords: [
      "lowest price",
      "best price",
      "most competitive price",
      "cheapest",
      "price leader",
    ],
    note: "Removed 'pricing' alone (too broad); replaced with superlative price claims",
  },
];

// ---------- New FINRA 2210 rules -------------------------------------------

type NewRule = {
  name: string;
  rule_type: "block" | "escalate" | "review" | "guide";
  description: string;
  keywords: string[];
  wsp_reference: string;
  // regulatory_basis is appended into description because the rules table
  // doesn't have a regulatory_basis column today (consistent with
  // scripts/seed-earnings-rule.ts).
  regulatory_basis: string;
};

const NEW_RULES: NewRule[] = [
  {
    name: "Performance Projections",
    rule_type: "block",
    description:
      "Projected or guaranteed performance claims are prohibited in retail communications under FINRA Rule 2210(d)(1)(F).",
    keywords: [
      "guaranteed return",
      "guaranteed yield",
      "will return",
      "will achieve",
      "no risk",
      "risk-free return",
      "assured return",
      "projected return of",
      "target return of",
      "expected return of",
    ],
    wsp_reference: "Section 4.2 — Performance Communications",
    regulatory_basis: "FINRA Rule 2210(d)(1)(F)",
  },
  {
    name: "Testimonials Without Disclosure",
    rule_type: "escalate",
    description:
      "Client testimonials and endorsements require specific disclosures under FINRA Rule 2210(d)(6) and the SEC Marketing Rule.",
    keywords: [
      "my client said",
      "client testimonial",
      "client endorses",
      "client recommends",
      "as my client put it",
      "one of our clients told us",
    ],
    wsp_reference: "Section 4.5 — Testimonials and Endorsements",
    regulatory_basis: "FINRA Rule 2210(d)(6) · SEC Marketing Rule",
  },
  {
    name: "AI Content Disclosure",
    rule_type: "guide",
    description:
      "Communications containing AI-generated content may require disclosure under EU AI Act Article 50 and FINRA 2026 GenAI guidance.",
    // Empty by design — triggered by submission_type, not keyword match.
    // Stored with an empty array so the rule_check engine simply skips it.
    keywords: [],
    wsp_reference: "Section 6.1 — AI-Generated Content",
    regulatory_basis: "EU AI Act Art. 50 · FINRA 2026 GenAI Report",
  },
];

async function tightenExisting(): Promise<{ updated: string[]; skipped: string[] }> {
  const updated: string[] = [];
  const skipped: string[] = [];
  for (const u of RULE_UPDATES) {
    if (!u.keywords) {
      skipped.push(`  · ${u.name}: ${u.note}`);
      continue;
    }
    const { data, error } = await sb
      .from("rules")
      .update({ keywords: u.keywords })
      .eq("org_id", DEMO_ORG_ID)
      .eq("name", u.name)
      .select("id");
    if (error) {
      console.error(`  ✗ ${u.name}: ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) {
      skipped.push(`  · ${u.name}: not found in org`);
      continue;
    }
    updated.push(`  ✓ ${u.name} → [${u.keywords.join(", ")}]`);
  }
  return { updated, skipped };
}

async function addNewRules(): Promise<{ inserted: string[]; existing: string[] }> {
  const inserted: string[] = [];
  const existing: string[] = [];
  for (const r of NEW_RULES) {
    const { data: found } = await sb
      .from("rules")
      .select("id")
      .eq("org_id", DEMO_ORG_ID)
      .eq("name", r.name)
      .maybeSingle();
    if (found) {
      existing.push(`  · ${r.name} (${r.rule_type}) — already present`);
      continue;
    }
    // Append the regulatory basis to the description so it's still visible
    // on the rule card without requiring a schema change.
    const description = `${r.description} Regulatory basis: ${r.regulatory_basis}.`;
    const { error } = await sb.from("rules").insert({
      org_id: DEMO_ORG_ID,
      name: r.name,
      rule_type: r.rule_type,
      description,
      keywords: r.keywords,
      scope: "all_speakers",
      rule_status: "active",
      effective_from: new Date().toISOString(),
      effective_to: null,
      wsp_reference: r.wsp_reference,
    });
    if (error) {
      console.error(`  ✗ ${r.name}: ${error.message}`);
      continue;
    }
    inserted.push(`  ✓ ${r.name} (${r.rule_type})`);
  }
  return { inserted, existing };
}

async function main() {
  console.log("Tightening existing rule keyword sets...");
  const { updated, skipped } = await tightenExisting();
  for (const line of updated) console.log(line);
  for (const line of skipped) console.log(line);

  console.log("\nAdding new FINRA 2210 rules...");
  const { inserted, existing } = await addNewRules();
  for (const line of inserted) console.log(line);
  for (const line of existing) console.log(line);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("FAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
