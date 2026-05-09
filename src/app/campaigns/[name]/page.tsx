import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveOrgId } from "@/lib/auth-helpers";
import { getSupabaseAdmin } from "@/lib/checks";
import { SiteHeader } from "@/app/site-header";
import {
  CampaignCommunications,
  ExportPdfButton,
  type CampaignDraft,
} from "./campaign-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type PageProps = { params: Promise<{ name: string }> };

type DraftRow = {
  id: string;
  draft_text: string;
  status: string;
  submitted_at: string;
  channel: string;
  users: { name: string; title: string | null } | null;
  campaigns: { name: string } | null;
};

type ActionLite = {
  draft_id: string;
  action_type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
};

type SpeakerStat = {
  name: string;
  title: string;
  total: number;
  approved: number;
  blocked: number;
};

type CampaignMetaRow = {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  description: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function getCampaignData(campaignName: string) {
  const sb = getSupabaseAdmin();
  const orgId = await resolveOrgId();

  const [draftsRes, campaignsRes, principalRes, rulesRes] = await Promise.all([
    sb
      .from("drafts")
      .select(
        "id, draft_text, status, submitted_at, channel, users:speaker_id(name, title), campaigns(name)",
      )
      .eq("org_id", orgId)
      .order("submitted_at", { ascending: false }),
    sb
      .from("campaigns")
      .select("name, starts_at, ends_at, description")
      .eq("org_id", orgId)
      .eq("name", campaignName)
      .maybeSingle(),
    sb
      .from("users")
      .select("name, title")
      .eq("org_id", orgId)
      .eq("role", "principal")
      .maybeSingle(),
    sb
      .from("rules")
      .select("name")
      .eq("org_id", orgId)
      .eq("rule_status", "active")
      .order("name"),
  ]);

  if (draftsRes.error) throw new Error("drafts: " + draftsRes.error.message);

  const allDrafts = (draftsRes.data || []) as unknown as DraftRow[];
  const drafts = allDrafts.filter((d) => d.campaigns?.name === campaignName);
  // The campaign meta lookup tells us whether the campaign itself
  // exists; an unknown campaign 404s. A real campaign with zero drafts
  // renders the D4 empty state ("No drafts submitted this campaign.")
  // instead of bouncing the visitor.
  const campaignExists = !!campaignsRes.data;
  if (drafts.length === 0 && !campaignExists) return null;

  // Pull the actions we need to compute hasDecision per draft + each
  // draft's primary_match rule (drives the per-row rule chip and the
  // C2 rule dropdown filter).
  const draftIds = drafts.map((d) => d.id);
  const actionsRes = await sb
    .from("actions")
    .select("draft_id, action_type, occurred_at, payload")
    .eq("org_id", orgId)
    .in("draft_id", draftIds)
    .in("action_type", [
      "submitted",
      "draft_submitted",
      "verdict_issued",
      "reviewer_decided",
    ]);

  const actions = (actionsRes.data || []) as ActionLite[];
  const actionsByDraft = new Map<string, ActionLite[]>();
  for (const a of actions) {
    const list = actionsByDraft.get(a.draft_id) ?? [];
    list.push(a);
    actionsByDraft.set(a.draft_id, list);
  }

  const campaignMeta =
    (campaignsRes.data as CampaignMetaRow | null) ?? {
      name: campaignName,
      starts_at: null,
      ends_at: null,
      description: null,
    };

  const principalName =
    (principalRes.data as { name?: string; title?: string | null } | null)?.name ?? null;
  const principalTitle =
    (principalRes.data as { name?: string; title?: string | null } | null)?.title ?? null;

  const ruleNames = ((rulesRes.data ?? []) as Array<{ name: string }>).map(
    (r) => r.name,
  );

  return {
    drafts,
    actionsByDraft,
    campaignMeta,
    principalName,
    principalTitle,
    ruleNames,
  };
}

export default async function CampaignRecordPage({ params }: PageProps) {
  const { name } = await params;
  const campaignName = decodeURIComponent(name);
  const result = await getCampaignData(campaignName);
  if (!result) notFound();
  const {
    drafts,
    actionsByDraft,
    campaignMeta,
    principalName,
    principalTitle,
    ruleNames,
  } = result;

  // ----- Per-draft enrichment ---------------------------------------------
  const hasDecision = (draftId: string) =>
    (actionsByDraft.get(draftId) ?? []).some(
      (a) => a.action_type === "reviewer_decided",
    );

  // Pull primary_match.rule_name off the latest verdict_issued action
  // for each draft. Used both for the C2 rule chip on each row and for
  // the rule-filter selection logic in CampaignCommunications.
  function triggeredRuleNameFor(draftId: string): string | null {
    const verdictActions = (actionsByDraft.get(draftId) ?? []).filter(
      (a) => a.action_type === "verdict_issued",
    );
    if (verdictActions.length === 0) return null;
    const latest = verdictActions[verdictActions.length - 1];
    const pm = latest.payload?.primary_match as
      | { rule_name?: string }
      | null
      | undefined;
    return pm?.rule_name ?? null;
  }

  const enrichedDrafts: CampaignDraft[] = drafts.map((d) => ({
    id: d.id,
    draft_text: d.draft_text,
    status: d.status,
    submitted_at: d.submitted_at,
    channel: d.channel,
    speaker_name: d.users?.name ?? "—",
    speaker_title: d.users?.title ?? "",
    has_decision: hasDecision(d.id),
    triggered_rule_name: triggeredRuleNameFor(d.id),
  }));

  // ----- C1 stats: drafts submitted / cleared / blocked / pending ---------
  // Stats come straight from real submission data — no engagement /
  // reach / open metrics are computed or invented anywhere.
  const draftsSubmitted = enrichedDrafts.length;
  const cleared = enrichedDrafts.filter(
    (d) => d.status === "approved" || d.status === "overridden",
  ).length;
  const blocked = enrichedDrafts.filter(
    (d) => d.status === "blocked" && d.has_decision,
  ).length;
  const pendingReview = enrichedDrafts.filter(
    (d) =>
      (d.status === "blocked" || d.status === "escalated") && !d.has_decision,
  ).length;

  // ----- Speaker breakdown ------------------------------------------------
  const speakerMap = new Map<string, SpeakerStat>();
  for (const d of drafts) {
    const speakerName = d.users?.name ?? "Unknown";
    const existing = speakerMap.get(speakerName) ?? {
      name: speakerName,
      title: d.users?.title ?? "",
      total: 0,
      approved: 0,
      blocked: 0,
    };
    existing.total++;
    if (d.status === "approved" || d.status === "overridden")
      existing.approved++;
    if (d.status === "blocked") existing.blocked++;
    speakerMap.set(speakerName, existing);
  }
  const speakers = Array.from(speakerMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  // ----- Display strings for the header + print summary -------------------
  const dateRangeLabel =
    campaignMeta.starts_at && campaignMeta.ends_at
      ? `${fmtDate(campaignMeta.starts_at)} – ${fmtDate(campaignMeta.ends_at)}`
      : campaignMeta.starts_at
        ? `From ${fmtDate(campaignMeta.starts_at)}`
        : campaignMeta.ends_at
          ? `Through ${fmtDate(campaignMeta.ends_at)}`
          : "—";

  const principalLabel = IS_DEMO_MODE
    ? "[Principal on record]"
    : principalName
      ? `${principalName}${principalTitle ? `, ${principalTitle}` : ""}`
      : "—";

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB] print:bg-white">
        <div className="max-w-[1100px] mx-auto px-6 py-10 print:py-0 print:px-0">
          {/* ─── Print-only summary (C4) ─────────────────────────────
              Hidden on screen, shown in print. Page 1 of the PDF
              contains: campaign name, date range, governing principal,
              the four stat cards, and the legal disclaimer. The
              page-break-after rule pushes any subsequent screen content
              onto page 2 of the printed PDF, but in practice the rest
              of the page is print:hidden so the export stops here. */}
          <div className="hidden print:block p-8" style={{ pageBreakAfter: "always" }}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
              ERA CUE · Campaign summary
            </div>
            <h1 className="text-2xl font-light text-[#0F172A] leading-tight">
              {campaignName}
            </h1>
            <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
              <dt className="text-[#64748B]">Date range</dt>
              <dd className="text-[#0F172A]">{dateRangeLabel}</dd>
              <dt className="text-[#64748B]">Governing principal</dt>
              <dd className="text-[#0F172A]">{principalLabel}</dd>
            </dl>

            <div className="mt-6 grid grid-cols-4 gap-3">
              {[
                { label: "Drafts submitted", value: draftsSubmitted },
                { label: "Cleared", value: cleared },
                { label: "Blocked", value: blocked },
                { label: "Pending review", value: pendingReview },
              ].map((card) => (
                <div
                  key={card.label}
                  className="border border-[#E2E8F0] rounded-sm p-4"
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
                    {card.label}
                  </div>
                  <div className="font-mono text-3xl font-light text-[#0F172A]">
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs text-[#64748B] leading-relaxed">
              ERA CUE records that governance processes ran for the
              communications included in this report. Whether these
              communications satisfy applicable regulatory requirements
              is a determination for qualified legal counsel.
            </p>
          </div>

          {/* Header — screen view */}
          <div className="mb-8 print:hidden">
            <Link
              href="/drafts"
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A]"
            >
              ← Archive
            </Link>
            <div className="flex justify-between items-end gap-4 flex-wrap mt-3">
              <div className="min-w-0">
                <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                  CAMPAIGN RECORD
                </div>
                <h1
                  style={{ fontFamily: "var(--font-newsreader)" }}
                  className="font-light text-3xl text-[#0F172A] mt-2"
                >
                  {campaignName}
                </h1>
                <p className="text-sm text-[#374151] mt-2 max-w-2xl leading-relaxed">
                  Governance record for all communications under this campaign.
                </p>
                <div className="font-mono text-xs text-[#64748B] mt-2">
                  {dateRangeLabel} · Governed by: {principalLabel}
                </div>
              </div>
              <ExportPdfButton />
            </div>
          </div>

          {/* C1 — Four stat cards. Real submission data only; no
              engagement / reach / open metrics are surfaced anywhere
              on this page. */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 print:hidden">
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Drafts submitted
              </div>
              <div className="font-mono text-3xl font-light text-[#0F172A]">
                {draftsSubmitted}
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Total in this campaign
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#166534] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Cleared
              </div>
              <div className="font-mono text-3xl font-light text-[#166534]">
                {cleared}
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Approved verdicts
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#B91C1C] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Blocked
              </div>
              <div className="font-mono text-3xl font-light text-[#B91C1C]">
                {blocked}
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Block verdicts confirmed
              </div>
            </div>
            <div className="bg-white border border-[#E2E8F0] border-t-2 border-t-[#1A56DB] rounded-sm p-5">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
                Pending review
              </div>
              <div className="font-mono text-3xl font-light text-[#1A56DB]">
                {pendingReview}
              </div>
              <div className="font-mono text-xs text-[#64748B] mt-1">
                Awaiting principal decision
              </div>
            </div>
          </section>

          {/* Speaker breakdown */}
          <section className="mt-10 print:hidden">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SPEAKERS
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              {speakers.map((s) => {
                const pct =
                  s.total > 0 ? Math.round((s.approved / s.total) * 100) : 0;
                return (
                  <div
                    key={s.name}
                    className="bg-white border border-[#E2E8F0] rounded-sm p-4"
                  >
                    <div className="text-sm font-semibold text-[#0F172A]">
                      {s.name}
                    </div>
                    <div className="font-mono text-xs text-[#64748B]">
                      {s.title}
                    </div>
                    <div className="flex gap-4 mt-3 font-mono text-xs text-[#64748B]">
                      <span>{s.total} submitted</span>
                      <span className="text-[#166534]">
                        {s.approved} cleared
                      </span>
                      <span className="text-[#B91C1C]">
                        {s.blocked} blocked
                      </span>
                    </div>
                    <div className="mt-2 bg-[#F1F5F9] rounded-full h-1">
                      <div
                        className="bg-[#1A56DB] h-1 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                        aria-label={`${pct}% cleared`}
                      />
                    </div>
                    <Link
                      href={`/drafts?speaker=${encodeURIComponent(s.name)}`}
                      className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors mt-3 inline-block"
                    >
                      View all →
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          {/* C2 + C3 + draft list — interactive client island */}
          <CampaignCommunications
            drafts={enrichedDrafts}
            ruleNames={ruleNames}
          />
        </div>
      </main>
    </>
  );
}
