import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/checks";
import { ReviewForm } from "./review-form";

// Public reviewer page. No login required (route is in
// middleware.ts PUBLIC_PATHS). Reviewer receives a /review/<token>
// link, lands here, sees the verdict + draft + decision controls, and
// records APPROVED / CHANGES REQUESTED / ESCALATED. The action runs
// against the service-role admin client so the token itself is the
// access credential.

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { params: Promise<{ token: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  channel: string;
  status: string;
  submitted_at: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionRow = {
  action_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
};

async function getReviewData(token: string) {
  const sb = getSupabaseAdmin();
  // Token === draft id for now. When the publish_token column lands
  // for the inbound direction, swap this to a token-column lookup.
  const { data: draft, error: dErr } = await sb
    .from("drafts")
    .select(
      "id, draft_text, channel, status, submitted_at, users(name, title), campaigns(name)",
    )
    .eq("id", token)
    .maybeSingle();
  if (dErr || !draft) return null;
  const { data: actions } = await sb
    .from("actions")
    .select("action_type, payload, occurred_at")
    .eq("draft_id", token)
    .order("occurred_at", { ascending: true });
  return {
    draft: draft as unknown as DraftRow,
    actions: (actions ?? []) as ActionRow[],
  };
}

export default async function PublicReviewPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getReviewData(token);
  if (!data) notFound();
  const { draft, actions } = data;

  // Latest verdict (re-runs append; the live state is the most recent).
  const verdictAction = [...actions]
    .reverse()
    .find((a) => a.action_type === "verdict_issued");
  const verdict = (verdictAction?.payload?.verdict as string) || "review";
  const primaryMatch = verdictAction?.payload?.primary_match as
    | { rule_name?: string; rule_description?: string; matched_keyword?: string }
    | null
    | undefined;

  const decided = actions.some((a) => a.action_type === "reviewer_decided");

  return (
    <ReviewForm
      token={token}
      draftText={draft.draft_text}
      channel={draft.channel}
      submittedAt={draft.submitted_at}
      speakerName={draft.users?.name ?? null}
      speakerTitle={draft.users?.title ?? null}
      campaignName={draft.campaigns?.name ?? null}
      verdict={verdict}
      ruleName={primaryMatch?.rule_name ?? null}
      ruleDescription={primaryMatch?.rule_description ?? null}
      matchedKeyword={primaryMatch?.matched_keyword ?? null}
      alreadyDecided={decided}
    />
  );
}
