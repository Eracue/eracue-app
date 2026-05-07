"use server";

import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

export type PublicationInput = {
  draftId: string;
  platform: string;
  url: string | null;
  publishedAt: string;
};

export type PublicationResult =
  | { success: true; error?: undefined }
  | { success?: undefined; error: string };

// Records a publication after a draft is approved/overridden. Writes an
// immutable action row (so the audit trail captures it forever) and
// updates the draft with the published_* fields so the receipt and
// downstream queries can show the live state.
//
// The draft update relies on three columns added in
// scripts/migrate-publication-fields.ts. If the SQL hasn't been run yet,
// the action insert still succeeds (audit trail intact) and the draft
// update fails gracefully with a friendly error.
export async function recordPublicationAction(
  input: PublicationInput,
): Promise<PublicationResult> {
  const sb = getSupabaseAdmin();

  if (!input.platform) return { error: "Platform is required." };

  // Append-only action — captures the publication regardless of whether
  // the new draft columns exist yet.
  const { error: actionErr } = await sb.from("actions").insert({
    org_id: DEMO_ORG_ID,
    draft_id: input.draftId,
    action_type: "publication_recorded",
    actor_kind: "user",
    payload: {
      platform: input.platform,
      url: input.url,
      published_at: input.publishedAt,
    },
    occurred_at: new Date().toISOString(),
  });
  if (actionErr) return { error: "Failed to record publication: " + actionErr.message };

  // Mirror to drafts. If the migration hasn't been applied this errors
  // with code 42703; the audit trail still has the truth.
  const { error: updErr } = await sb
    .from("drafts")
    .update({
      published_platform: input.platform,
      published_url: input.url,
      published_at: input.publishedAt,
    })
    .eq("id", input.draftId)
    .eq("org_id", DEMO_ORG_ID);
  if (updErr) {
    return {
      error:
        "Action recorded, but draft columns missing — run scripts/migrate-publication-fields.ts SQL in Supabase. (" +
        updErr.message +
        ")",
    };
  }

  return { success: true };
}
