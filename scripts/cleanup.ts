import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // List all orgs
  const { data: allOrgs } = await sb.from("orgs").select("id, name, created_at").order("created_at");
  console.log("All orgs in database:");
  for (const o of allOrgs!) console.log(`  ${o.id}  ${o.name}  (${o.created_at})`);

  // Identify the keeper: the most recent ERA CUE Demo Co
  const keepers = allOrgs!.filter((o) => o.name === "ERA CUE Demo Co");
  if (keepers.length !== 1) {
    console.error(`\nFAIL: expected exactly 1 'ERA CUE Demo Co', found ${keepers.length}`);
    process.exit(1);
  }
  const keeperId = keepers[0].id;
  console.log(`\nKeeper: ${keeperId}`);

  const ghostOrgs = allOrgs!.filter((o) => o.name !== "ERA CUE Demo Co");
  console.log(`\nGhost orgs to attempt to remove: ${ghostOrgs.length}`);

  for (const ghost of ghostOrgs) {
    // Check if any action references this org
    const { count: actionCount } = await sb.from("actions").select("*", { count: "exact", head: true }).eq("org_id", ghost.id);
    if (actionCount && actionCount > 0) {
      console.log(`  SKIP ${ghost.name} (${ghost.id}) — ${actionCount} action(s) reference it; cannot delete due to append-only invariant`);
      continue;
    }
    // Safe to delete: no actions reference this org. Delete users and drafts will cascade.
    const { error: delErr } = await sb.from("orgs").delete().eq("id", ghost.id);
    if (delErr) {
      console.log(`  FAIL deleting ${ghost.name}: ${delErr.message}`);
    } else {
      console.log(`  DELETED ${ghost.name} (${ghost.id})`);
    }
  }

  // Final counts
  console.log("\nFINAL COUNTS:");
  for (const t of ["orgs", "users", "campaigns", "rules", "drafts", "actions"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count}`);
  }

  // Final counts scoped to the keeper org (these are what the demo will see)
  console.log("\nKEEPER-ONLY COUNTS (what the demo queries will see):");
  for (const t of ["users", "campaigns", "rules", "drafts", "actions"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true }).eq("org_id", keeperId);
    console.log(`  ${t}: ${count}`);
  }

  process.exit(0);
}

main().catch((err) => { console.error("FAIL:", err.message); process.exit(1); });
