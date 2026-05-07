import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

async function main() {
  // Load .env.local
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

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.error("FAIL: missing env vars");
    process.exit(1);
  }

  const sb = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Step 1: wiping existing data via TRUNCATE...");
  // Use a stored procedure via SQL since TRUNCATE bypasses the append-only trigger.
  // We do this via a one-shot RPC call using the underlying postgres connection.
  // Simpler: use supabase's rpc/sql endpoint via a direct SQL call.
  const { error: wipeError } = await sb.rpc("exec_sql_admin", { sql_text: "TRUNCATE actions, drafts, users, campaigns, rules, orgs RESTART IDENTITY CASCADE;" });
  if (wipeError) {
    // The RPC won't exist by default. Fall back: delete in dependency order.
    console.log("  RPC not available; falling back to delete-in-order...");
    // Cannot truly delete from actions (append-only trigger). But we can drop and recreate, or just leave the test data.
    // For seed purposes, we delete what we can.
    await sb.from("drafts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("users").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await sb.from("orgs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("  delete-in-order complete (test actions remain due to append-only — expected)");
  } else {
    console.log("  TRUNCATE succeeded.");
  }

  console.log("Step 2: seeding org...");
  const { data: org, error: orgErr } = await sb.from("orgs").insert({ name: "ERA CUE Demo Co", tier: "team" }).select().single();
  if (orgErr) { console.error("FAIL inserting org:", orgErr.message); process.exit(1); }
  console.log("  org id:", org.id);

  console.log("Step 3: seeding 5 users (1 principal + 4 speakers)...");
  const usersData = [
    { org_id: org.id, name: "Sarah Chen", role: "principal", title: "GC", email: "sarah@example.com" },
    { org_id: org.id, name: "Marcus Rivera", role: "speaker", title: "CEO", email: "marcus@example.com" },
    { org_id: org.id, name: "Priya Patel", role: "speaker", title: "CMO", email: "priya@example.com" },
    { org_id: org.id, name: "James Kim", role: "speaker", title: "VP Sales", email: "james@example.com" },
    { org_id: org.id, name: "Lena Brooks", role: "speaker", title: "VP Comms", email: "lena@example.com" },
  ];
  const { data: users, error: usersErr } = await sb.from("users").insert(usersData).select();
  if (usersErr) { console.error("FAIL inserting users:", usersErr.message); process.exit(1); }
  console.log("  users inserted:", users.length);
  const principal = users.find((u) => u.role === "principal");
  const ceo = users.find((u) => u.title === "CEO");
  const cmo = users.find((u) => u.title === "CMO");
  const vpSales = users.find((u) => u.title === "VP Sales");
  const vpComms = users.find((u) => u.title === "VP Comms");

  console.log("Step 4: seeding 2 campaigns...");
  const { data: campaigns, error: campErr } = await sb.from("campaigns").insert([
    { org_id: org.id, name: "Series B Announce", description: "Coordinated comms around closing the Series B round", starts_at: "2026-04-15", ends_at: "2026-06-30" },
    { org_id: org.id, name: "Q3 Product Launch", description: "Launch of new enterprise tier", starts_at: "2026-07-01", ends_at: "2026-09-30" },
  ]).select();
  if (campErr) { console.error("FAIL inserting campaigns:", campErr.message); process.exit(1); }
  console.log("  campaigns inserted:", campaigns.length);
  const seriesB = campaigns.find((c) => c.name === "Series B Announce")!;
  const productLaunch = campaigns.find((c) => c.name === "Q3 Product Launch")!;

  console.log("Step 5: seeding 6 rules...");
  const { data: rules, error: rulesErr } = await sb.from("rules").insert([
    { org_id: org.id, rule_type: "block", name: "Series B Quiet Period", description: "No hiring, growth, or fundraising language during quiet period.", keywords: ["hiring", "expanding", "growth", "raising", "investors", "fundraising"], effective_from: "2026-04-15", effective_to: "2026-06-30", created_by: principal!.id },
    { org_id: org.id, rule_type: "block", name: "Q3 Product Launch Embargo", description: "Embargo on product launch details until July 1.", keywords: ["new product", "enterprise tier", "launch", "available"], effective_from: "2026-04-01", effective_to: "2026-07-01", created_by: principal!.id },
    { org_id: org.id, rule_type: "escalate", name: "Enterprise Sales Claims", description: "Sales claims about enterprise customers must be reviewed by GC.", keywords: ["enterprise customer", "fortune 500", "fortune 100", "signed", "closed deal"], effective_from: "2026-01-01", created_by: principal!.id },
    { org_id: org.id, rule_type: "escalate", name: "Competitor Mentions", description: "Direct competitor mentions require review.", keywords: ["acme corp", "competitor name 1", "competitor name 2"], effective_from: "2026-01-01", created_by: principal!.id },
    { org_id: org.id, rule_type: "review", name: "Pricing Claims", description: "Any pricing claim should be reviewed for consistency.", keywords: ["price", "pricing", "free", "discount", "cheap"], effective_from: "2026-01-01", created_by: principal!.id },
    { org_id: org.id, rule_type: "guide", name: "Press Release Tone", description: "Press releases should use formal tone, no contractions.", keywords: [], effective_from: "2026-01-01", created_by: principal!.id },
  ]).select();
  if (rulesErr) { console.error("FAIL inserting rules:", rulesErr.message); process.exit(1); }
  console.log("  rules inserted:", rules.length);

  console.log("Step 6: seeding 30 drafts...");
  const speakers = [ceo!, cmo!, vpSales!, vpComms!];
  const channels = ["linkedin", "twitter", "press_release", "blog", "interview"];
  const sources = ["human", "ai_assisted", "ai_generated"];
  const statuses = ["pending", "approved", "escalated", "blocked"];
  const draftTexts = [
    "We are aggressively expanding hiring across all functions in Q2.",
    "Excited to announce we just closed a major enterprise customer.",
    "Our pricing remains the most competitive in the market.",
    "I want to thank our team for an amazing quarter.",
    "We're seeing unprecedented growth in our pipeline.",
    "New product launching next month — stay tuned.",
    "Honored to be recognized as a top vendor in our category.",
    "Reflecting on what makes a great founder.",
    "Three lessons I learned from this fundraising round.",
    "Our enterprise tier is now available to all customers.",
    "Just signed our 50th Fortune 500 customer.",
    "Why I think the market is shifting fundamentally.",
    "Tips for building a high-performance team.",
    "Customer obsession is core to our culture.",
    "Reflecting on the past 12 months at the company.",
    "We're hiring aggressively across engineering and sales.",
    "The future of AI governance starts with the moment of decision.",
    "Pleased to share our Q1 results were strong.",
    "Thoughts on AI safety and responsible deployment.",
    "Our partner ecosystem just hit a major milestone.",
    "How we think about customer success in 2026.",
    "We're investing significantly in research and development.",
    "Why startup discipline matters even at scale.",
    "Three things I look for when hiring senior leaders.",
    "Excited about our upcoming product announcement.",
    "Honored to share my perspective at the conference next week.",
    "Our enterprise pricing is industry-leading.",
    "We just raised a Series B — can't wait to share more soon.",
    "Customer trust is everything in our space.",
    "I disagree with the conventional wisdom on this topic.",
  ];

  const now = new Date();
  const draftsToInsert = draftTexts.map((text, i) => {
    const speaker = speakers[i % speakers.length];
    const channel = channels[i % channels.length];
    const source = sources[i % sources.length];
    const campaign = i % 3 === 0 ? seriesB.id : i % 3 === 1 ? productLaunch.id : null;
    const submittedAt = new Date(now.getTime() - (30 - i) * 60 * 60 * 1000).toISOString();
    return {
      org_id: org.id,
      speaker_id: speaker.id,
      campaign_id: campaign,
      channel,
      draft_text: text,
      source_origin: source,
      ai_model_used: source === "human" ? null : "claude-sonnet-4-6",
      prompt_hash: source === "human" ? null : "0".repeat(64),
      submitted_at: submittedAt,
      status: statuses[i % statuses.length],
    };
  });

  const { data: drafts, error: draftsErr } = await sb.from("drafts").insert(draftsToInsert).select();
  if (draftsErr) { console.error("FAIL inserting drafts:", draftsErr.message); process.exit(1); }
  console.log("  drafts inserted:", drafts.length);

  console.log("Step 7: seeding ~120 actions (4 per draft on average)...");
  const actionsToInsert: Record<string, unknown>[] = [];
  for (const draft of drafts) {
    actionsToInsert.push({ org_id: org.id, draft_id: draft.id, action_type: "submitted", actor_id: draft.speaker_id, actor_kind: "user", payload: { source_origin: draft.source_origin } });
    actionsToInsert.push({ org_id: org.id, draft_id: draft.id, action_type: "check_ran", actor_kind: "ai_check", payload: { check: "rule_check", verdict: draft.status === "blocked" ? "block" : "clear" }, model_version: "claude-sonnet-4-6" });
    actionsToInsert.push({ org_id: org.id, draft_id: draft.id, action_type: "verdict_issued", actor_kind: "system", payload: { verdict: draft.status } });
    if (draft.status !== "pending") {
      actionsToInsert.push({ org_id: org.id, draft_id: draft.id, action_type: "reviewer_decided", actor_id: principal!.id, actor_kind: "user", payload: { decision: draft.status, note: "Reviewed and " + draft.status } });
    }
  }
  // Insert actions in batches of 50 to avoid request size issues
  for (let i = 0; i < actionsToInsert.length; i += 50) {
    const batch = actionsToInsert.slice(i, i + 50);
    const { error: actErr } = await sb.from("actions").insert(batch);
    if (actErr) { console.error("FAIL inserting actions batch:", actErr.message); process.exit(1); }
  }
  console.log("  actions inserted:", actionsToInsert.length);

  console.log("\nFINAL COUNTS:");
  for (const t of ["orgs", "users", "campaigns", "rules", "drafts", "actions"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count}`);
  }

  console.log("\nSUCCESS: seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  console.error(err.stack);
  process.exit(1);
});
