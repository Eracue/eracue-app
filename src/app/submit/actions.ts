"use server";

import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";

type SubmitInput = {
  speakerId: string;
  channel: string;
  sourceOrigin: string;
  campaignId: string | null;
  draftText: string;
};

type SubmitResult = { draftId: string; error?: undefined } | { draftId?: undefined; error: string };

export async function submitDraftAction(input: SubmitInput): Promise<SubmitResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { error: "Server is not configured. Contact admin." };
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: draft, error: draftErr } = await sb.from("drafts").insert({
    org_id: DEMO_ORG_ID,
    speaker_id: input.speakerId,
    campaign_id: input.campaignId,
    channel: input.channel,
    draft_text: input.draftText,
    source_origin: input.sourceOrigin,
    ai_model_used: input.sourceOrigin === "human" ? null : "claude-sonnet-4-6",
    prompt_hash: input.sourceOrigin === "human" ? null : "0".repeat(64),
    status: "pending",
  }).select("id").single();
  if (draftErr || !draft) return { error: "Failed to save draft: " + (draftErr?.message || "unknown") };
  const { error: actionErr } = await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: draft.id,
    action_type: "submitted",
    actor_id: input.speakerId,
    actor_kind: "user",
    payload: { source_origin: input.sourceOrigin, channel: input.channel, campaign_id: input.campaignId },
  });
  if (actionErr) console.error("WARNING: action row failed:", actionErr.message);
  return { draftId: draft.id };
}
