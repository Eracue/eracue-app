import { NextRequest } from "next/server";
import { renderToBuffer, DocumentProps } from "@react-pdf/renderer";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { ExaminerPdf } from "../pdf-document";
import React from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  source_origin: string;
  ai_model_used: string | null;
  prompt_hash: string | null;
  status: string;
  submitted_at: string;
  speaker_id: string;
  campaign_id: string | null;
  users: { name: string; title: string | null; email: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionRow = {
  id: string;
  action_type: string;
  actor_kind: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  rules_active: string[] | null;
  model_version: string | null;
  occurred_at: string;
  row_hash: string;
};

type RuleRow = {
  id: string;
  name: string;
  rule_type: string;
  description: string;
  effective_from: string;
  effective_to: string | null;
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = getSupabaseAdmin();

  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select("id, draft_text, channel, source_origin, ai_model_used, prompt_hash, status, submitted_at, speaker_id, campaign_id, users(name, title, email), campaigns(name)")
    .eq("id", id)
    .eq("org_id", DEMO_ORG_ID)
    .single();
  if (dErr || !draft) {
    return new Response("Draft not found", { status: 404 });
  }

  const { data: actionsData } = await sb
    .from("actions")
    .select("id, action_type, actor_kind, actor_id, payload, rules_active, model_version, occurred_at, row_hash")
    .eq("draft_id", id)
    .order("occurred_at", { ascending: true });

  const actions = (actionsData || []) as ActionRow[];

  const allRuleIds = new Set<string>();
  for (const a of actions) {
    for (const rid of a.rules_active || []) allRuleIds.add(rid);
  }
  let rules: RuleRow[] = [];
  if (allRuleIds.size > 0) {
    const { data: rulesData } = await sb
      .from("rules")
      .select("id, name, rule_type, description, effective_from, effective_to")
      .in("id", Array.from(allRuleIds));
    rules = (rulesData || []) as RuleRow[];
  }

  const actorIds = Array.from(new Set(actions.map((a) => a.actor_id).filter((x): x is string => !!x)));
  const actors: Record<string, { name: string; title: string | null }> = {};
  if (actorIds.length > 0) {
    const { data: actorData } = await sb.from("users").select("id, name, title").in("id", actorIds);
    for (const u of actorData || []) actors[u.id] = { name: u.name, title: u.title };
  }

  const buffer = await renderToBuffer(
    React.createElement(ExaminerPdf, {
      draft: draft as unknown as DraftRow,
      actions,
      rules,
      actors,
    }) as React.ReactElement<DocumentProps>
  );

  const shortId = draft.id.slice(0, 8);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="examiner-record-${shortId}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
