import { notFound } from "next/navigation";
import { resolveOrgId } from "@/lib/auth-helpers";
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
  const orgId = await resolveOrgId();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select(
      "id, draft_text, channel, source_origin, ai_model_used, prompt_hash, prompt_used, status, submitted_at, speaker_id, campaign_id, communication_category, content_type, intended_audience, users(name, title, email), campaigns(name)",
    )
    .eq("id", draftId)
    .eq("org_id", orgId)
    .single();
  if (dErr || !draft) return null;

  // Publication fields live on three columns added by
  // scripts/migrate-publication-fields.ts. The select is wrapped in
  // try/catch so the receipt still renders before the migration is
  // applied — values stay null in that window.
  let pubFields: {
    published_platform: string | null;
    published_url: string | null;
    published_at: string | null;
  } = { published_platform: null, published_url: null, published_at: null };
  try {
    const { data: pubRow, error: pubErr } = await sb
      .from("drafts")
      .select("published_platform, published_url, published_at")
      .eq("id", draftId)
      .maybeSingle();
    if (!pubErr && pubRow) {
      pubFields = {
        published_platform:
          (pubRow as { published_platform?: string | null }).published_platform ?? null,
        published_url:
          (pubRow as { published_url?: string | null }).published_url ?? null,
        published_at:
          (pubRow as { published_at?: string | null }).published_at ?? null,
      };
    }
  } catch {
    // Columns missing — leave nulls.
  }

  // Publish-token fields — same defensive read as publication fields.
  // Populated by scripts/publish-token-migration.sql; rows pre-dating
  // the migration just stay null.
  let tokenFields: {
    publish_token: string | null;
    publish_token_expires_at: string | null;
    draft_hash_at_approval: string | null;
  } = {
    publish_token: null,
    publish_token_expires_at: null,
    draft_hash_at_approval: null,
  };
  try {
    const { data: tokRow, error: tokErr } = await sb
      .from("drafts")
      .select("publish_token, publish_token_expires_at, draft_hash_at_approval")
      .eq("id", draftId)
      .maybeSingle();
    if (!tokErr && tokRow) {
      tokenFields = {
        publish_token:
          (tokRow as { publish_token?: string | null }).publish_token ?? null,
        publish_token_expires_at:
          (tokRow as { publish_token_expires_at?: string | null })
            .publish_token_expires_at ?? null,
        draft_hash_at_approval:
          (tokRow as { draft_hash_at_approval?: string | null })
            .draft_hash_at_approval ?? null,
      };
    }
  } catch {
    // Columns missing — leave nulls.
  }

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
    draft: { ...(draft as object), ...pubFields, ...tokenFields } as unknown as DraftRow,
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
