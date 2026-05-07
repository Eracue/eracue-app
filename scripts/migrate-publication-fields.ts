import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Same .env.local-loading pattern as scripts/seed-earnings-rule.ts so this
// script doesn't depend on dotenv being installed.
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

const SQL = `
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS published_platform TEXT,
  ADD COLUMN IF NOT EXISTS published_url       TEXT,
  ADD COLUMN IF NOT EXISTS published_at        TIMESTAMPTZ;
`.trim();

async function main() {
  // Probe one of the new columns. If it errors, the columns aren't there
  // yet and the user needs to run the SQL below in the Supabase SQL editor
  // (the JS client can't run DDL).
  const { error } = await sb.from("drafts").select("published_platform").limit(1);

  if (!error) {
    console.log("✓ Publication columns already exist on the drafts table.");
    return;
  }

  console.log("⚠ Publication columns not present. Run this SQL in Supabase:");
  console.log("");
  console.log(SQL);
  console.log("");
  console.log("Then re-run this script to verify.");
}

main().catch((err) => {
  console.error("Migration probe failed:", err);
  process.exit(1);
});
