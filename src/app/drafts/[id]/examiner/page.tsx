import { notFound } from "next/navigation";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import {
  ExaminerClient,
  type ActionRow,
  type Actors,
  type DraftRow,
  type RuleRow,
} from "./examiner-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
};

async function getExaminerRecord(draftId: string) {
  const sb = getSupabaseAdmin();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select(
      "id, draft_text, channel, source_origin, ai_model_used, prompt_hash, prompt_used, status, submitted_at, speaker_id, campaign_id, communication_category, content_type, intended_audience, users(name, title, email), campaigns(name)",
    )
    .eq("id", draftId)
    .eq("org_id", DEMO_ORG_ID)
    .single();
  if (dErr || !draft) return null;

  const { data: actions } = await sb
    .from("actions")
    .select(
      "id, action_type, actor_kind, actor_id, payload, rules_active, model_version, occurred_at, row_hash",
    )
    .eq("draft_id", draftId)
    .order("occurred_at", { ascending: true });

  // Pull every rule referenced by any action (for Section 3 context).
  const allRuleIds = new Set<string>();
  for (const a of actions || []) {
    for (const rid of a.rules_active || []) allRuleIds.add(rid);
  }
  let rules: RuleRow[] = [];
  if (allRuleIds.size > 0) {
    const { data: rulesData } = await sb
      .from("rules")
      .select(
        "id, name, rule_type, description, effective_from, effective_to, wsp_reference",
      )
      .in("id", Array.from(allRuleIds));
    rules = (rulesData || []) as RuleRow[];
  }

  // Resolve actor names so the audit trail can render real principals.
  const actorIds = Array.from(
    new Set(
      (actions || []).map((a) => a.actor_id).filter((x): x is string => !!x),
    ),
  );
  const actors: Actors = {};
  if (actorIds.length > 0) {
    const { data: actorData } = await sb
      .from("users")
      .select("id, name, title")
      .in("id", actorIds);
    for (const u of actorData || []) actors[u.id] = { name: u.name, title: u.title };
  }

  return {
    draft: draft as unknown as DraftRow,
    actions: (actions || []) as ActionRow[],
    rules,
    actors,
  };
}

export default async function GovernanceRecordPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const result = await getExaminerRecord(id);
  if (!result) notFound();

  // Pre-compute the generation timestamp on the server so the client
  // component renders an exact-match value (no hydration drift).
  const generatedAt = new Date().toISOString();
  const defaultView: "summary" | "full" = sp.view === "full" ? "full" : "summary";

  return (
    <ExaminerClient
      {...result}
      defaultView={defaultView}
      generatedAt={generatedAt}
    />
  );
}
