"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { submitDraftAction } from "./actions";
import type { CheckEntry } from "@/lib/checks";

// ---------- Types --------------------------------------------------------

export type SubmitFlow = "demo" | "new_user" | "returning";

export type SpeakerInfo = {
  id: string;
  display_name: string;
  title: string | null;
  role: string | null;
  is_current_user: boolean;
};

// Active rule metadata threaded down from the server. Drives the
// "Rules active" expandable section (FIX 2) and the post-verdict
// "Rules checked" panel (FIX 6). Defaults are merged in client-side
// when the action returns usedDefaultRules=true.
export type ActiveRule = {
  id: string;
  name: string;
  verdict: "block" | "review" | "escalate" | "guide";
  keywords: string[];
  regulatoryBasis: string | null;
  authorizedBy: string | null;
};

// Mirrors `RuleResult` from actions.ts. Re-declared here so the form
// doesn't have to import a server-action type at the top level.
type RuleResult = {
  ruleId: string;
  ruleName: string;
  verdict: "block" | "review" | "escalate" | "guide";
  triggered: boolean;
  matchedKeyword?: string;
  regulatoryBasis?: string;
  authorizedBy?: string;
};

type CampaignConsistency = {
  priorCount: number;
  gap: boolean;
  gapKeywords?: string[];
};

// Defaults metadata mirrored from actions.ts. The form uses this
// purely for the "Rules active" preview when the org has zero rules
// — the server still owns the real ruleset on submission.
const DEFAULT_RULES_PREVIEW: ReadonlyArray<ActiveRule> = [
  {
    id: "default-1",
    name: "Quiet Period Language",
    verdict: "block",
    keywords: [
      "fundraising",
      "raising",
      "investors",
      "closing our round",
      "series",
    ],
    regulatoryBasis: null,
    authorizedBy: null,
  },
  {
    id: "default-2",
    name: "Forward Guidance",
    verdict: "block",
    keywords: ["expects", "projects", "anticipates", "guidance", "outlook"],
    regulatoryBasis: null,
    authorizedBy: null,
  },
  {
    id: "default-3",
    name: "Material Information",
    verdict: "block",
    keywords: [
      "material",
      "non-public",
      "confidential deal",
      "embargoed",
      "not yet announced",
    ],
    regulatoryBasis: null,
    authorizedBy: null,
  },
  {
    id: "default-4",
    name: "Competitor Disparagement",
    verdict: "review",
    keywords: [
      "unlike our competitors",
      "better than any competitor",
      "no competitor can",
    ],
    regulatoryBasis: null,
    authorizedBy: null,
  },
  {
    id: "default-5",
    name: "Unsubstantiated Claims",
    verdict: "review",
    keywords: ["guaranteed", "always works", "never fails", "100% proven"],
    regulatoryBasis: null,
    authorizedBy: null,
  },
];

type Props = {
  flow: SubmitFlow;
  fromRules: boolean;
  activatedCount: number;
  firmType: string;
  speakers: SpeakerInfo[];
  ruleCount: number;
  activeRules: ActiveRule[];
  // FIX 2 — when ?campaign= matches a campaign that has a
  // non-empty campaign_rules allowlist, the page passes those ids
  // here. Null = implicit-all (every active rule applies).
  campaignScopedRuleIds: string[] | null;
  corpusCount: number;
  currentUserName: string | null;
  isDemoMode: boolean;
  // FIX 2 — solo founder path. When false (no principal in this
  // org), the BLOCK verdict's "Request review" card is hidden and a
  // configuration-prompt block takes its place.
  hasPrincipal: boolean;
};

type VerdictData = {
  ruleName?: string;
  ruleDescription?: string;
  matchedKeyword?: string;
  draftId?: string;
  checks?: CheckEntry[];
  // FIX 6/7/12 — verdict-time data the form needs to render the
  // post-submission rules-checked panel and the multi-rule banner.
  usedDefaultRules?: boolean;
  ruleResults?: RuleResult[];
  triggeredRules?: RuleResult[];
  ruleCountChecked?: number;
  authorizedBy?: string | null;
  // FIX 8 — campaign consistency outcome (only present when the
  // submission carried a campaign name).
  campaignConsistency?: CampaignConsistency;
};

// Channels offered in the pill row. AI agent post covers drafts
// produced by an autonomous agent acting on behalf of an executive —
// the FINRA agentic-AI submission path the engine treats as a
// distinct origin from a human composing in a web tool.
const CHANNELS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitter", label: "Twitter / X" },
  { key: "press_release", label: "Press release" },
  { key: "internal_memo", label: "Internal memo" },
  { key: "ai_agent_post", label: "AI agent post" },
];

// Hardcoded fallback used by the demo "Try an example →" link when no
// BLOCK rule keyword is available to splice into the smart template.
// Trips the Series B Quiet Period rule on the keywords "expanding" and
// "fundraising" so a visitor sees a BLOCK verdict the moment they click.
const FALLBACK_EXAMPLE_DRAFT =
  "We're aggressively expanding our team and excited to share updates on our fundraising progress soon.";

// FIX 11 — speaker allowlist. Sarah Chen is the GC (role='principal',
// already filtered server-side), but the spec requires an explicit
// belt-and-braces filter so she never appears in the speaker grid even
// if the seed drift assigns her role='speaker'. The grid renders these
// four names plus the "Other" tile.
const ALLOWED_SPEAKER_NAMES = new Set([
  "James Kim",
  "Lena Brooks",
  "Marcus Rivera",
  "Priya Patel",
]);

// Plain-English verdict labels and palette. Rendered on the verdict
// header so a non-compliance reader doesn't have to map BLOCK /
// ESCALATE / REVIEW / GUIDE / CLEAR onto behaviour.
const VERDICT_META: Record<
  string,
  { label: string; headerBg: string; headerBorder: string; badgeBg: string }
> = {
  block: {
    label: "Blocked",
    headerBg: "bg-[#FEF2F2]",
    headerBorder: "border-[#FECACA]",
    badgeBg: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  },
  escalate: {
    label: "Needs review",
    headerBg: "bg-[#FFF7ED]",
    headerBorder: "border-[#FED7AA]",
    badgeBg: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  },
  review: {
    label: "Flagged",
    headerBg: "bg-[#EFF6FF]",
    headerBorder: "border-[#BFDBFE]",
    badgeBg: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  },
  guide: {
    label: "Note",
    headerBg: "bg-[#F5F3FF]",
    headerBorder: "border-[#DDD6FE]",
    badgeBg: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
  },
  clear: {
    label: "Cleared",
    headerBg: "bg-[#F0FDF4]",
    headerBorder: "border-[#BBF7D0]",
    badgeBg: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
  },
};

// ---------- Severity badge (matches the rules table) ---------------------

function severityBadge(verdict: string) {
  const v = (verdict || "").toLowerCase();
  if (v === "block") {
    return (
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA] shrink-0">
        Block
      </span>
    );
  }
  if (v === "review" || v === "escalate") {
    return (
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] shrink-0">
        Review
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] shrink-0">
      Flag
    </span>
  );
}

// ---------- Form ---------------------------------------------------------

export function SubmitForm({
  flow,
  fromRules,
  activatedCount,
  firmType,
  speakers,
  ruleCount,
  activeRules,
  campaignScopedRuleIds,
  corpusCount,
  currentUserName,
  isDemoMode,
  hasPrincipal,
}: Props) {
  // corpusCount is preserved on the props contract for the page
  // component but no longer surfaces in the UI — the new
  // three-line CheckingState narrative is static.
  void corpusCount;
  // firmType is no longer used to route the example — the demo flow
  // shows a single canonical draft. Reference the variable so an
  // unused-prop lint never flags the page→form contract.
  void firmType;

  // FIX 11 — restrict the visible speaker grid to the allowlisted
  // names, plus the current authenticated user (so a real returning
  // visitor sees themselves regardless of their name). Sarah Chen
  // never appears: she's role='principal' (filtered server-side) and
  // her name isn't in ALLOWED_SPEAKER_NAMES anyway.
  const filteredSpeakers = useMemo(
    () =>
      speakers.filter(
        (s) => ALLOWED_SPEAKER_NAMES.has(s.display_name) || s.is_current_user,
      ),
    [speakers],
  );

  const initialSpeaker: SpeakerInfo | null =
    filteredSpeakers.find((s) => s.is_current_user) ??
    (flow === "demo"
      ? (filteredSpeakers.find((s) => s.display_name === "Marcus Rivera") ??
        null)
      : null) ??
    filteredSpeakers[0] ??
    null;

  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(
    initialSpeaker?.id ?? null,
  );
  // FIX 11 — "Other" pseudo-speaker. When selected, the speaker grid
  // hands the action a free-text name + title rather than a known
  // user id. The action's name → user lookup will surface "Speaker
  // not found" if the name doesn't match any user row; we render
  // that error inline.
  const [otherSelected, setOtherSelected] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherTitle, setOtherTitle] = useState("");
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);
  const [channel, setChannel] = useState<string>("linkedin");
  const [draftText, setDraftText] = useState("");
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Campaign is visible by default; demo flow pre-selects "Series B" so
  // the first-time visitor sees a fully-populated submission.
  //
  // `?campaign=<name>` (URL-decoded by Next.js) wins over the demo
  // default — so a VP Comms can share
  //   app.eracue.com/check?campaign=Series%20B%20Announce
  // and speakers land with the campaign already filled in. Read on
  // first render only; user edits to the field afterwards stand.
  const searchParams = useSearchParams();
  const initialCampaignFromUrl = searchParams.get("campaign");
  const [campaign, setCampaign] = useState(
    initialCampaignFromUrl?.trim() || (flow === "demo" ? "Series B" : ""),
  );
  // Submission origin — submission_method is read-only "web app" in this
  // surface; aiInvolvement is the EU AI Act / FINRA disclosure checkbox.
  const submissionMethod = "web app";
  const [aiInvolvement, setAiInvolvement] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingStage, setCheckingStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);

  // FIX 3 — AI agent post auto-declares AI involvement and disables
  // the checkbox. Clearing the channel restores manual control.
  useEffect(() => {
    if (channel === "ai_agent_post") setAiInvolvement(true);
  }, [channel]);

  // FIX 2 — auto-expand the rules section when arriving via a
  // ?campaign= deep link, so the speaker immediately sees what
  // they're about to be checked against. Manual clicks afterwards
  // still toggle as expected.
  const [rulesExpanded, setRulesExpanded] = useState<boolean>(
    Boolean(initialCampaignFromUrl?.trim()),
  );

  // FIX 5 — smart "Try an example" template. Picks the first BLOCK
  // rule (campaign-scoped if applicable) and splices its first
  // keyword into the canonical sentence. Falls back to the original
  // hardcoded draft when no BLOCK rule is available.
  const exampleDraft = useMemo(() => {
    const allowed = campaignScopedRuleIds
      ? new Set(campaignScopedRuleIds)
      : null;
    const pool: ReadonlyArray<ActiveRule> =
      ruleCount === 0 ? DEFAULT_RULES_PREVIEW : activeRules;
    const blockRule = pool.find(
      (r) =>
        r.verdict === "block" &&
        (r.keywords?.length ?? 0) > 0 &&
        (!allowed || allowed.has(r.id)),
    );
    const kw = blockRule?.keywords?.[0];
    if (!kw) return FALLBACK_EXAMPLE_DRAFT;
    return `We're excited to share that we're ${kw} and growing fast — more updates coming soon.`;
  }, [activeRules, campaignScopedRuleIds, ruleCount]);

  // For new-user with zero speakers — we still render a "Yourself"
  // card in the speaker section, but submission against the action
  // requires a matching `users.name` row. Submit is gated server-
  // side; we keep the button enabled and surface the error inline
  // if the lookup fails.
  const selectedSpeaker =
    filteredSpeakers.find((s) => s.id === selectedSpeakerId) ?? null;

  const speakerNameForSubmit = otherSelected
    ? otherName.trim()
    : (selectedSpeaker?.display_name ?? currentUserName ?? "");

  // Speakers visible in the grid before the user clicks "+ N more".
  // For more than six speakers we collapse the grid to the first
  // six so the page doesn't scroll on a normal viewport.
  const displaySpeakers =
    showAllSpeakers || filteredSpeakers.length <= 6
      ? filteredSpeakers
      : filteredSpeakers.slice(0, 6);

  async function handleSubmit() {
    // FIX 4 — empty-draft validation. Inline error + focus textarea;
    // do not run the check.
    if (!draftText.trim()) {
      setError("Add your draft text before submitting.");
      draftTextareaRef.current?.focus();
      return;
    }
    if (!speakerNameForSubmit) {
      setError("Add a speaker before submitting a draft.");
      return;
    }
    setError(null);
    setChecking(true);
    setCheckingStage(0);
    setVerdict(null);
    setVerdictData(null);

    // Stage advance — purely visual, runs on its own clock so the
    // three narrative lines light up sequentially (800ms apart) even
    // when the underlying submitDraftAction returns sub-second.
    const stage1 = setTimeout(() => setCheckingStage(1), 800);
    const stage2 = setTimeout(() => setCheckingStage(2), 1600);

    try {
      const result = await submitDraftAction({
        draftText,
        speakerName: speakerNameForSubmit,
        channel,
        // EU AI Act Article 50 — what the user declared on this submission.
        sourceOrigin: aiInvolvement ? "ai_assisted" : "human",
        submissionType: channel === "ai_agent_post" ? "agent" : "human",
        // Browser request → web_app. The future API path will set this
        // to "api"; the action stores the value verbatim.
        submissionMethod: "web_app",
        campaignName: campaign.trim() || null,
        ...(otherSelected && otherTitle.trim()
          ? { speakerTitle: otherTitle.trim() }
          : {}),
        ...(campaignScopedRuleIds
          ? { campaignScopedRuleIds }
          : {}),
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if (!("verdict" in result)) {
        setError("Submission failed. Please try again.");
        return;
      }

      setVerdict(result.verdict);
      setVerdictData({
        ruleName: result.ruleName,
        ruleDescription: result.ruleDescription,
        matchedKeyword: result.matchedKeyword,
        draftId: result.draftId,
        checks: result.checks,
        usedDefaultRules: result.usedDefaultRules,
        ruleResults: result.ruleResults,
        triggeredRules: result.triggeredRules,
        ruleCountChecked: result.ruleCountChecked,
        authorizedBy: result.authorizedBy ?? null,
        campaignConsistency: result.campaignConsistency,
      });
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      clearTimeout(stage1);
      clearTimeout(stage2);
      setChecking(false);
    }
  }

  function handleReset() {
    setVerdict(null);
    setVerdictData(null);
    setDraftText("");
    setCampaign(flow === "demo" ? "Series B" : "");
    setAiInvolvement(channel === "ai_agent_post");
    setError(null);
  }

  // D3 — the BLOCK "Revise and resubmit" card calls this. Clears the
  // draft body and dismisses the verdict so the form re-mounts, but
  // keeps speaker / campaign / channel / AI declaration intact.
  function handleRevise() {
    setVerdict(null);
    setVerdictData(null);
    setDraftText("");
    setError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const verdictLower = verdict?.toLowerCase() ?? null;
  const verdictMeta = verdictLower
    ? (VERDICT_META[verdictLower] ?? VERDICT_META.review)
    : null;
  const isBlockOrEscalate =
    verdictLower === "block" || verdictLower === "escalate";

  // Ghost button for the post-verdict action row. Demo + returning
  // share "Go to review queue", new_user gets the speaker invite link.
  const ghostButton =
    flow === "new_user"
      ? { href: "/onboarding/speakers", label: "Invite your team to submit drafts" }
      : { href: "/review", label: "Go to review queue" };

  // FIX 1 — page headline + subhead. Submit page renders ALWAYS now,
  // even when ruleCount === 0 (defaults will be used). Subhead branches
  // by rule count.
  const headline = "Submit for governance review";
  const subhead =
    ruleCount > 0
      ? `ERA CUE checks every draft against your ${ruleCount} active rule${ruleCount !== 1 ? "s" : ""} before it reaches any platform.`
      : "ERA CUE will check against 5 default governance rules. Configure your own rules for specific requirements.";

  // FIX 2 — the rule list shown in the "Rules active" expandable
  // section. When the org has zero rules we surface the defaults so
  // the speaker can still inspect what will be checked. When a
  // campaign is selected with a non-empty allowlist, we filter to
  // those ids.
  const rulesForDisplay = useMemo<ActiveRule[]>(() => {
    if (ruleCount === 0) return [...DEFAULT_RULES_PREVIEW];
    if (campaignScopedRuleIds && campaignScopedRuleIds.length > 0) {
      const allow = new Set(campaignScopedRuleIds);
      return activeRules.filter((r) => allow.has(r.id));
    }
    return activeRules;
  }, [activeRules, campaignScopedRuleIds, ruleCount]);

  return (
    <div className="max-w-[720px] mx-auto px-6 py-10">
      {/* ─── Context bar — flow-specific ────────────────────────────── */}
      {flow === "demo" && fromRules && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-4 mb-6 flex items-start gap-3">
          <span className="text-[#166534] shrink-0 text-base mt-0.5" aria-hidden>
            ✓
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium text-[#0F172A] mb-0.5">
              {activatedCount > 0
                ? `${activatedCount} governance rules are active.`
                : "Your governance rules are active."}
            </div>
            <div className="text-sm text-[#64748B]">
              ERA CUE will check every draft against them. Try the example
              below to see a rule fire.
            </div>
          </div>
        </div>
      )}

      {flow === "new_user" && ruleCount > 0 && (
        <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm p-4 mb-6 flex items-start gap-3">
          <span className="text-[#1A56DB] shrink-0 text-base mt-0.5" aria-hidden>
            →
          </span>
          <div>
            <div className="text-sm font-medium text-[#0F172A] mb-0.5">
              {`${ruleCount} rule${ruleCount !== 1 ? "s" : ""} are active.`}
            </div>
            <div className="text-sm text-[#64748B]">
              ERA CUE will check this draft against your active rules.
            </div>
          </div>
        </div>
      )}

      {/* FIX 1 — yellow defaults notice when the org has zero rules.
          The form below still renders so the speaker can submit; the
          server falls through to DEFAULT_RULES on the action side. */}
      {!isDemoMode && ruleCount === 0 && !verdictLower && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-sm p-4 mb-6 flex items-start gap-3">
          <span className="text-[#92400E] shrink-0 text-base mt-0.5" aria-hidden>
            ⚠
          </span>
          <div>
            <div className="text-sm font-medium text-[#0F172A] mb-0.5">
              No custom rules configured — checking against ERA CUE
              defaults.
            </div>
            <div className="text-sm text-[#64748B]">
              5 built-in governance rules will run on every submission.{" "}
              <a
                href="/rules"
                className="text-[#1A56DB] hover:text-[#1447C0] transition-colors"
              >
                Set up your own rules →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Page header — step indicator + title + flow-aware sub ────
          D7: collapsed on mobile when the verdict is visible so the
          verdict badge + matched rule name stay above the fold at 375
          × ~660 px. Desktop keeps the full header. */}
      <div className={`mb-6 ${verdictLower ? "hidden md:block" : ""}`}>
        {fromRules && (
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Step 2 of 3 — Check a draft
          </div>
        )}
        <h1
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="text-3xl font-light text-[#0F172A] mb-2"
        >
          {headline}
        </h1>
        <p className="text-sm text-[#64748B] leading-relaxed max-w-lg">
          {subhead}
        </p>
      </div>

      {/* ─── Body — three modes (form / checking / verdict) ─────────── */}
      {checking ? (
        <CheckingState stage={checkingStage} ruleCount={Math.max(ruleCount, 5)} />
      ) : verdictLower && verdictMeta ? (
        <VerdictView
          verdictKey={verdictLower}
          meta={verdictMeta}
          data={verdictData}
          isBlockOrEscalate={isBlockOrEscalate}
          flow={flow}
          ghostButton={ghostButton}
          onReset={handleReset}
          onRevise={handleRevise}
          draftText={draftText}
          isDemoMode={isDemoMode}
          hasPrincipal={hasPrincipal}
          campaignName={campaign.trim() || null}
          fallbackRuleCount={ruleCount}
          isCampaignScoped={Boolean(
            campaignScopedRuleIds && campaignScopedRuleIds.length > 0,
          )}
        />
      ) : (
        <FormBody
          flow={flow}
          speakers={filteredSpeakers}
          displaySpeakers={displaySpeakers}
          showAllSpeakers={showAllSpeakers}
          setShowAllSpeakers={setShowAllSpeakers}
          selectedSpeakerId={selectedSpeakerId}
          setSelectedSpeakerId={(id) => {
            setSelectedSpeakerId(id);
            setOtherSelected(false);
          }}
          otherSelected={otherSelected}
          setOtherSelected={(v) => {
            setOtherSelected(v);
            if (v) setSelectedSpeakerId(null);
          }}
          otherName={otherName}
          setOtherName={setOtherName}
          otherTitle={otherTitle}
          setOtherTitle={setOtherTitle}
          currentUserName={currentUserName}
          channel={channel}
          setChannel={setChannel}
          draftText={draftText}
          setDraftText={setDraftText}
          draftTextareaRef={draftTextareaRef}
          campaign={campaign}
          setCampaign={setCampaign}
          submissionMethod={submissionMethod}
          aiInvolvement={aiInvolvement}
          setAiInvolvement={setAiInvolvement}
          isDemoMode={isDemoMode}
          exampleDraft={exampleDraft}
          ruleCount={ruleCount}
          rulesForDisplay={rulesForDisplay}
          rulesExpanded={rulesExpanded}
          setRulesExpanded={setRulesExpanded}
          campaignFromUrl={initialCampaignFromUrl?.trim() ?? null}
          isCampaignScoped={Boolean(
            campaignScopedRuleIds && campaignScopedRuleIds.length > 0,
          )}
          checking={checking}
          error={error}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ---------- FormBody -----------------------------------------------------

function FormBody({
  flow,
  speakers,
  displaySpeakers,
  showAllSpeakers,
  setShowAllSpeakers,
  selectedSpeakerId,
  setSelectedSpeakerId,
  otherSelected,
  setOtherSelected,
  otherName,
  setOtherName,
  otherTitle,
  setOtherTitle,
  currentUserName,
  channel,
  setChannel,
  draftText,
  setDraftText,
  draftTextareaRef,
  campaign,
  setCampaign,
  submissionMethod,
  aiInvolvement,
  setAiInvolvement,
  isDemoMode,
  exampleDraft,
  ruleCount,
  rulesForDisplay,
  rulesExpanded,
  setRulesExpanded,
  campaignFromUrl,
  isCampaignScoped,
  checking,
  error,
  onSubmit,
}: {
  flow: SubmitFlow;
  speakers: SpeakerInfo[];
  displaySpeakers: SpeakerInfo[];
  showAllSpeakers: boolean;
  setShowAllSpeakers: (v: boolean) => void;
  selectedSpeakerId: string | null;
  setSelectedSpeakerId: (id: string) => void;
  otherSelected: boolean;
  setOtherSelected: (v: boolean) => void;
  otherName: string;
  setOtherName: (v: string) => void;
  otherTitle: string;
  setOtherTitle: (v: string) => void;
  currentUserName: string | null;
  channel: string;
  setChannel: (v: string) => void;
  draftText: string;
  setDraftText: (v: string) => void;
  draftTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  campaign: string;
  setCampaign: (v: string) => void;
  submissionMethod: string;
  aiInvolvement: boolean;
  setAiInvolvement: (v: boolean) => void;
  isDemoMode: boolean;
  exampleDraft: string;
  ruleCount: number;
  rulesForDisplay: ActiveRule[];
  rulesExpanded: boolean;
  setRulesExpanded: (v: boolean) => void;
  campaignFromUrl: string | null;
  isCampaignScoped: boolean;
  checking: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const usingDefaults = ruleCount === 0;
  const submitDisabled =
    !draftText.trim() ||
    (otherSelected
      ? !otherName.trim()
      : speakers.length > 0 && !selectedSpeakerId) ||
    (flow === "new_user" && speakers.length === 0 && !otherSelected && !currentUserName) ||
    checking;

  // Header label for the rules section: scoped to campaign when the
  // ?campaign= scope is active, defaults variant when ruleCount is 0,
  // generic otherwise.
  const ruleSectionLabel = isCampaignScoped
    ? `Rules active for ${campaignFromUrl ?? "this campaign"}`
    : usingDefaults
      ? "ERA CUE default governance rules"
      : `${rulesForDisplay.length} rule${rulesForDisplay.length !== 1 ? "s" : ""} active — see what will be checked`;

  return (
    <>
      {/* Speaker section — flow-specific. New-user collapses to a
          single "Yourself" card; returning + demo render a grid. */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
            Who is submitting this draft?
          </div>
        </div>
        <div className="p-4">
          {flow === "new_user" && speakers.length === 0 && !otherSelected ? (
            <>
              <div className="border border-[#1A56DB] bg-[#EFF8FF] rounded-sm p-3 mb-3 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1A56DB] text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                  {(currentUserName ?? "Y").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-[#0F172A] flex items-center gap-2">
                    {currentUserName ?? "You"}
                    <span className="font-mono text-[9px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-sm">
                      you
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    Checking as yourself
                  </div>
                </div>
              </div>
              <div className="text-sm text-[#94A3B8]">
                Your team isn&apos;t set up yet.{" "}
                <a
                  href="/onboarding/speakers"
                  className="text-[#1A56DB] hover:text-[#1447C0] transition-colors"
                >
                  Add speakers →
                </a>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {displaySpeakers.map((speaker) => {
                  const selected =
                    !otherSelected && selectedSpeakerId === speaker.id;
                  return (
                    <button
                      key={speaker.id}
                      type="button"
                      onClick={() => setSelectedSpeakerId(speaker.id)}
                      className={`text-left p-3 rounded-sm border transition-colors cursor-pointer ${
                        selected
                          ? "border-[#1A56DB] bg-[#EFF8FF]"
                          : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm font-medium text-[#0F172A] truncate">
                          {speaker.display_name}
                        </span>
                        {speaker.is_current_user && (
                          <span className="font-mono text-[9px] bg-[#1A56DB] text-white px-1.5 py-0.5 rounded-sm shrink-0">
                            you
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-[#64748B] truncate">
                        {speaker.title ?? speaker.role ?? ""}
                      </div>
                    </button>
                  );
                })}
                {/* FIX 11 — "Other" pseudo-speaker tile. Selecting it
                    deselects any preset speaker and reveals two text
                    inputs (name + optional title) inline below the
                    grid. The action submits the typed name verbatim;
                    when the name doesn't match a known user the
                    server returns "Speaker not found", surfaced
                    inline. */}
                <button
                  type="button"
                  onClick={() => setOtherSelected(!otherSelected)}
                  className={`text-left p-3 rounded-sm border transition-colors cursor-pointer ${
                    otherSelected
                      ? "border-[#1A56DB] bg-[#EFF8FF]"
                      : "border-dashed border-[#94A3B8] bg-white hover:border-[#1A56DB]"
                  }`}
                >
                  <div className="text-sm font-medium text-[#0F172A]">
                    Other
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    Custom name + title
                  </div>
                </button>
              </div>
              {speakers.length > 6 && !showAllSpeakers && (
                <button
                  type="button"
                  onClick={() => setShowAllSpeakers(true)}
                  className="font-mono text-xs text-[#64748B] mt-3 hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  + {speakers.length - 6} more
                </button>
              )}
              {otherSelected && (
                <div className="mt-3 pt-3 border-t border-[#E2E8F0] grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
                      Speaker name
                    </label>
                    <input
                      type="text"
                      value={otherName}
                      onChange={(e) => setOtherName(e.target.value)}
                      placeholder="e.g. Jordan Lee"
                      className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1">
                      Title{" "}
                      <span className="normal-case ml-1 text-[#94A3B8]">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={otherTitle}
                      onChange={(e) => setOtherTitle(e.target.value)}
                      placeholder="e.g. VP Communications"
                      className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Channel pills */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
            Where will this be published?
          </div>
        </div>
        <div className="p-4">
          <div className="flex gap-2 flex-wrap">
            {CHANNELS.map((ch) => {
              const selected = channel === ch.key;
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setChannel(ch.key)}
                  className={`font-mono text-xs px-4 py-2 rounded-sm border transition-colors cursor-pointer ${
                    selected
                      ? "bg-[#0F172A] border-[#0F172A] text-white"
                      : "bg-white border-[#E2E8F0] text-[#374151] hover:border-[#94A3B8]"
                  }`}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FIX 2 — Rules-that-will-run collapsible. Sits below the channel
          pills so the speaker sees the contract before drafting. The
          ?campaign= deep link auto-expands; manual interaction toggles
          freely afterwards. */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <button
          type="button"
          onClick={() => setRulesExpanded(!rulesExpanded)}
          aria-expanded={rulesExpanded}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-[#F8F9FB] transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] flex items-center gap-2">
            {ruleSectionLabel}
            {usingDefaults && (
              <span className="font-mono text-[9px] uppercase tracking-widest bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] px-1.5 py-0.5 rounded-sm normal-case">
                defaults
              </span>
            )}
          </span>
          <span aria-hidden className="text-[#94A3B8] text-xs">
            {rulesExpanded ? "▴" : "▾"}
          </span>
        </button>
        {rulesExpanded && (
          <div className="border-t border-[#E2E8F0] divide-y divide-[#F1F5F9]">
            {rulesForDisplay.length === 0 ? (
              <div className="p-4 text-sm text-[#94A3B8]">
                No rules in scope for this campaign yet.
              </div>
            ) : (
              rulesForDisplay.map((r) => {
                const firstKw = r.keywords?.[0];
                return (
                  <div
                    key={r.id}
                    className="px-4 py-2.5 flex items-center gap-3 flex-wrap"
                  >
                    {severityBadge(r.verdict)}
                    <span className="text-sm text-[#0F172A] font-medium">
                      {r.name}
                    </span>
                    {firstKw && (
                      <span className="font-mono text-xs bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                        {firstKw}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Submission origin — submission_method is auto-populated and
          read-only in this surface (web app). ai_involvement_declared is
          a self-attestation; ERA CUE records what is declared, not what
          can be inferred from the draft. */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#E2E8F0]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
            Submission origin
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5">
              Submission method
            </div>
            <div className="inline-flex items-center gap-2 border border-[#E2E8F0] bg-[#F8F9FB] rounded-sm px-3 py-1.5">
              <span className="font-mono text-xs text-[#0F172A]">
                {submissionMethod}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8]">
                auto
              </span>
            </div>
          </div>

          {/* FIX 3 — AI agent post auto-checks AI involvement and
              disables the checkbox. Note explains why; un-checking is
              suppressed because an autonomous agent submission is by
              definition AI-involved. */}
          <label
            className={`flex items-start gap-2.5 ${
              channel === "ai_agent_post" ? "cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={aiInvolvement}
              onChange={(e) => {
                if (channel !== "ai_agent_post") {
                  setAiInvolvement(e.target.checked);
                }
              }}
              disabled={channel === "ai_agent_post"}
              aria-disabled={channel === "ai_agent_post"}
              className="mt-0.5 w-4 h-4 accent-[#1A56DB] cursor-pointer disabled:cursor-not-allowed"
            />
            <span>
              <span className="block text-sm text-[#0F172A]">
                This draft included AI assistance.
              </span>
              <span className="block text-xs text-[#64748B] mt-1 leading-relaxed">
                {channel === "ai_agent_post"
                  ? "AI agent posts automatically declare AI involvement."
                  : "ERA CUE records what is declared. Disclosure obligations should be confirmed with qualified legal counsel."}
              </span>
            </span>
          </label>
        </div>
      </div>

      {/* Draft card — textarea + collapsed campaign field + submit row */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
            The draft
          </div>
          {isDemoMode && (
            <button
              type="button"
              onClick={() => {
                // D5 — restore the canonical demo state in one click
                // even if the visitor edited the speaker / channel /
                // campaign earlier on the page.
                //
                // FIX 5 — example draft is now derived from the active
                // BLOCK ruleset; the campaign default still snaps back
                // to "Series B" so the canonical fully-populated demo
                // submission still trips a rule.
                setDraftText(exampleDraft);
                setChannel("linkedin");
                setCampaign("Series B");
                const marcus = speakers.find(
                  (s) => s.display_name === "Marcus Rivera",
                );
                if (marcus) setSelectedSpeakerId(marcus.id);
              }}
              className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors cursor-pointer"
            >
              Try an example →
            </button>
          )}
        </div>

        <div className="p-4">
          <textarea
            ref={draftTextareaRef}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={
              flow === "demo"
                ? "Paste a draft here — or click 'Try an example →' above to see a rule fire."
                : "Paste the communication here — LinkedIn post, press release, email, or anything your team will publish publicly."
            }
            className="w-full min-h-[140px] text-sm text-[#0F172A] bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm px-4 py-3 leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Campaign — visible by default. Demo flow pre-selects "Series B"
            so the visitor sees a fully-populated submission. */}
        <div className="px-4 pb-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1.5">
            Campaign{" "}
            <span className="normal-case ml-1 text-[#94A3B8]">(optional)</span>
          </div>
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="Campaign name..."
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-1.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Submit row — rule count tag on the left, primary CTA on the
            right. Mirrors the rules page wording so the count framing
            stays consistent across the two surfaces. */}
        <div className="px-4 py-3 border-t border-[#E2E8F0] bg-[#F8F9FB] flex items-center justify-between gap-3 flex-wrap">
          <div className="font-mono text-[10px] text-[#94A3B8]">
            {usingDefaults
              ? "ERA CUE default governance rules will run"
              : `${ruleCount} governance rule${ruleCount !== 1 ? "s" : ""} active`}
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
          >
            {checking ? "Checking..." : "Check this draft →"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="font-mono text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-sm px-3 py-2"
          role="alert"
        >
          {error}
        </div>
      )}
    </>
  );
}

// ---------- CheckingState ------------------------------------------------

function CheckingState({
  stage,
  ruleCount,
}: {
  stage: 0 | 1 | 2;
  ruleCount: number;
}) {
  // Three-line progressive narrative. Each line lights up in sequence
  // (800ms apart, driven by setCheckingStage) so the visitor reads the
  // governance pipeline running in real time rather than staring at a
  // spinner. C5 — rule count comes from the live database query, not
  // a hardcoded value.
  const ruleCountLabel =
    ruleCount > 0
      ? `${ruleCount} active governance rule${ruleCount !== 1 ? "s" : ""}`
      : "active governance rules";
  const lines: ReadonlyArray<{ text: string; stage: 0 | 1 | 2 }> = [
    {
      text: `Checking against ${ruleCountLabel}...`,
      stage: 0,
    },
    {
      text: "Reviewing for consistency with prior approved statements...",
      stage: 1,
    },
    {
      text: "Preparing your governance record...",
      stage: 2,
    },
  ];

  return (
    <div
      className="bg-white border border-[#E2E8F0] rounded-sm p-8 mb-4"
      role="status"
      aria-live="polite"
    >
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-6">
        Checking your draft...
      </div>
      <div className="flex flex-col gap-3 max-w-[460px]">
        {lines.map((l) => {
          const visible = stage >= l.stage;
          const active = stage === l.stage;
          return (
            <div
              key={l.stage}
              className={`transition-opacity duration-300 ${
                visible ? "opacity-100" : "opacity-0"
              }`}
            >
              <span
                className={`font-mono text-xs leading-relaxed ${
                  active ? "text-[#0F172A] font-medium" : "text-[#94A3B8]"
                }`}
              >
                {l.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- VerdictView --------------------------------------------------

function VerdictView({
  verdictKey,
  meta,
  data,
  isBlockOrEscalate,
  flow,
  ghostButton,
  onReset,
  onRevise,
  draftText,
  isDemoMode,
  hasPrincipal,
  campaignName,
  fallbackRuleCount,
  isCampaignScoped,
}: {
  verdictKey: string;
  meta: { label: string; headerBg: string; headerBorder: string; badgeBg: string };
  data: VerdictData | null;
  isBlockOrEscalate: boolean;
  flow: SubmitFlow;
  ghostButton: { href: string; label: string };
  onReset: () => void;
  onRevise: () => void;
  draftText: string;
  isDemoMode: boolean;
  hasPrincipal: boolean;
  campaignName: string | null;
  fallbackRuleCount: number;
  isCampaignScoped: boolean;
}) {
  const draftId = data?.draftId;
  // The full `checks` array is still stored on `data.checks` for the
  // audit / examiner-record path; the verdict view no longer renders
  // it (replaced by the per-rule `ruleResults` panel + the
  // empty-state summary line below).
  const isClear = verdictKey === "clear";
  const ruleResults = data?.ruleResults ?? [];
  const triggeredRules = data?.triggeredRules ?? [];
  const usedDefaults = data?.usedDefaultRules === true;
  const ruleCountChecked = data?.ruleCountChecked ?? fallbackRuleCount;
  const passedCount = ruleResults.length - triggeredRules.length;
  const consistency = data?.campaignConsistency;

  // D4 — SHA-256 of the draft text for the "Record created" block.
  const [draftHash, setDraftHash] = useState<string | null>(null);
  useEffect(() => {
    if (!isClear) return;
    if (typeof window === "undefined" || !window.crypto?.subtle) return;
    const bytes = new TextEncoder().encode(draftText);
    let cancelled = false;
    window.crypto.subtle
      .digest("SHA-256", bytes)
      .then((buf) => {
        if (cancelled) return;
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setDraftHash(hex);
      })
      .catch(() => {
        // Browser without SubtleCrypto support — leave the field
        // showing "—" rather than crashing the verdict view.
      });
    return () => {
      cancelled = true;
    };
  }, [isClear, draftText]);

  // D5 — verdict-colored 2px border applied to the result card.
  const verdictBorder =
    verdictKey === "clear"
      ? "border-2 border-[#0EA5E9]"
      : verdictKey === "block"
        ? "border-2 border-[#EF4444]"
        : "border-2 border-[#F59E0B]";

  // FIX 7 — multi-rule banner. When more than one rule triggers we
  // swap the rule-name line for a count-led header and list every
  // triggered rule below the badge.
  const multiRule = triggeredRules.length > 1;

  // FIX 10 — first triggered rule's authorized_by drives the routing
  // copy on the BLOCK card. When unavailable, fall back to "principal".
  const routeTarget = data?.authorizedBy?.trim() || "principal";

  // FIX 6 header — distinguishes defaults vs. custom rules and
  // surfaces the totals.
  const rulesCheckedHeader = usedDefaults
    ? `Default governance rules checked (${ruleCountChecked} total · ${triggeredRules.length} triggered · ${passedCount} passed)`
    : `Rules checked (${ruleCountChecked} total · ${triggeredRules.length} triggered · ${passedCount} passed)`;

  return (
    <>
      {/* Verdict card — header carries the plain-English label + rule
          context; body lists the checks that ran. The 2px verdict-
          colored border + transition is the D5 delivery animation. */}
      <div
        className={`bg-white rounded-sm overflow-hidden mb-4 transition-all duration-300 ease-in ${verdictBorder}`}
      >
        <div className={`px-5 py-4 border-b ${meta.headerBg} ${meta.headerBorder}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-sm border ${meta.badgeBg}`}
            >
              {meta.label}
            </span>
            {multiRule ? (
              <span className="text-sm font-medium text-[#0F172A]">
                {triggeredRules.length} rules triggered — draft blocked
              </span>
            ) : (
              data?.ruleName && (
                <span className="text-sm font-medium text-[#0F172A]">
                  {data.ruleName}
                </span>
              )
            )}
          </div>
          {/* Single-rule legacy line (keyword + description). For
              multi-rule, the per-rule list below renders the same
              info per row. */}
          {!multiRule && data?.matchedKeyword && (
            <div className="font-mono text-[10px] text-[#64748B] mt-2">
              Keyword: &ldquo;{data.matchedKeyword}&rdquo;
              {data.ruleDescription && (
                <span> · {data.ruleDescription}</span>
              )}
            </div>
          )}
          {multiRule && (
            <ul className="mt-3 space-y-1">
              {triggeredRules.map((r) => (
                <li
                  key={r.ruleId}
                  className="font-mono text-[11px] text-[#0F172A] flex items-start gap-2"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] mt-1.5 shrink-0"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{r.ruleName}</span>
                    {r.matchedKeyword && (
                      <span className="text-[#64748B]">
                        {" "}
                        · matched: &ldquo;{r.matchedKeyword}&rdquo;
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* FIX 6 — Rules checked panel. Replaces the legacy "Checks
            performed" list: every rule that ran appears, triggered
            rules with a red dot + matched keyword + regulatory basis,
            passed rules with a grey checkmark. */}
        {ruleResults.length > 0 && (
          <div className="px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              {rulesCheckedHeader}
              {isCampaignScoped && campaignName && (
                <span className="normal-case ml-2 text-[#94A3B8]">
                  · scoped to {campaignName}
                </span>
              )}
            </div>
            <div className="space-y-1">
              {ruleResults.map((r) => (
                <div
                  key={r.ruleId}
                  className="flex items-start gap-2 py-1 flex-wrap"
                >
                  {r.triggered ? (
                    <span
                      className="w-2 h-2 rounded-full bg-[#B91C1C] mt-1.5 shrink-0"
                      aria-hidden
                    />
                  ) : (
                    <span className="text-[#94A3B8] text-xs mt-0.5" aria-hidden>
                      ✓
                    </span>
                  )}
                  <span className="font-mono text-xs text-[#0F172A]">
                    {r.ruleName}
                  </span>
                  {r.triggered && r.matchedKeyword && (
                    <span className="font-mono text-[10px] text-[#B91C1C]">
                      · matched: &ldquo;{r.matchedKeyword}&rdquo;
                    </span>
                  )}
                  {r.triggered && r.regulatoryBasis && (
                    <span className="font-mono text-[10px] text-[#64748B]">
                      · {r.regulatoryBasis}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty-ruleResults fallback — happens when the action
            ran the rules but every one passed and the server
            collapsed the per-rule list. Render a single summary line
            instead of the legacy "Rule Check / Consistency Check /
            Alignment Check / Quiet Period Check" generic ladder
            which leaked internal check taxonomy into the speaker UI.
            Only renders when at least one rule actually ran; with
            zero rules the verdict view is intentionally silent. */}
        {ruleResults.length === 0 && ruleCountChecked > 0 && (
          <div className="px-5 py-4">
            <div className="font-mono text-xs text-[#0F172A] flex items-center gap-2">
              <span className="text-[#166534] text-sm" aria-hidden>
                ✓
              </span>
              {ruleCountChecked} rule{ruleCountChecked === 1 ? "" : "s"}{" "}
              checked · all passed
            </div>
          </div>
        )}
      </div>

      {/* FIX 8 — Campaign consistency panel. Only renders when the
          submission carried a campaign name and the server returned
          a campaignConsistency payload. Amber banner when a gap is
          found, green banner when the prior cleared corpus is
          consistent. Always carries the legal note. */}
      {campaignName && consistency && (
        <div
          className={`rounded-sm p-4 mb-4 border ${
            consistency.gap
              ? "bg-[#FFFBEB] border-[#FDE68A]"
              : "bg-[#F0FDF4] border-[#BBF7D0]"
          }`}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
            Campaign consistency: {consistency.priorCount} prior draft
            {consistency.priorCount === 1 ? "" : "s"} compared
          </div>
          <div
            className={`text-sm font-medium mb-1 ${
              consistency.gap ? "text-[#92400E]" : "text-[#166534]"
            }`}
          >
            {consistency.gap
              ? "Possible consistency gap — review recommended."
              : "Consistent with prior approved campaign drafts."}
          </div>
          {consistency.gap && (
            <div className="text-sm text-[#92400E] mb-2">
              ERA CUE surfaces this for your team&apos;s judgment.
              {consistency.gapKeywords && consistency.gapKeywords.length > 0 && (
                <span className="block font-mono text-xs text-[#0F172A] mt-1">
                  Overlapping keywords:{" "}
                  {consistency.gapKeywords
                    .map((k) => `"${k}"`)
                    .join(", ")}
                </span>
              )}
            </div>
          )}
          <div className="text-[#64748B] text-xs leading-relaxed">
            ERA CUE surfaces keyword patterns for review. Whether this
            creates a consistency issue is a judgment for your
            communications team.
          </div>
        </div>
      )}

      {/* F2 — Message House contradiction signal. Demo-only,
          BLOCK-only: the surface illustrates how a campaign-level
          pillar contradiction would surface alongside the rule
          verdict. Production deployments will derive this from the
          campaign's stored pillars + the consistency check. CLEARED
          verdicts intentionally never show this row. */}
      {isDemoMode && verdictKey === "block" && (
        <div className="bg-white border border-[#E2E8F0] rounded-sm p-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-mono text-[9px] uppercase tracking-widest text-[#94A3B8]"
              aria-label="Demo signal"
            >
              Demo signal
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[#F59E0B]" aria-hidden>
              ⚠
            </span>
            <span className="font-mono text-xs text-[#0F172A]">
              Message House · Pillar 02
            </span>
            <span className="font-mono text-xs text-[#C2410C]">
              possible contradiction detected
            </span>
          </div>
          <p className="text-[#64748B] text-xs mt-2 leading-relaxed">
            ERA CUE surfaces a possible pillar contradiction. Whether
            this affects your communication is a judgment for your team.
          </p>
        </div>
      )}

      {/* FIX 10 — BLOCK / ESCALATE next-steps cards. Card 1 routes to
          the rule's authorized_by reviewer; Card 2 keeps the existing
          "Revise and resubmit" affordance. Solo-founder path replaces
          Card 1 with a configuration prompt. */}
      {isBlockOrEscalate && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {hasPrincipal ? (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-5 flex flex-col">
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                Route to {routeTarget} for review
              </div>
              <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
                Send this draft to{" "}
                {routeTarget === "principal" ? "your named principal" : routeTarget}{" "}
                for a governance decision.
              </p>
              {draftId ? (
                <a
                  href={`/review/${draftId}`}
                  className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] transition-colors text-center"
                >
                  Route to {routeTarget} for review →
                </a>
              ) : (
                <span className="font-mono text-xs text-[#94A3B8]">
                  Review link unavailable
                </span>
              )}
            </div>
          ) : (
            <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-5 flex flex-col">
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                No principal configured
              </div>
              <p className="text-sm text-[#374151] leading-relaxed flex-1">
                ERA CUE has recorded this check. To enable full
                supervisory records, add a principal in your
                organization settings.
              </p>
            </div>
          )}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-5 flex flex-col">
            <div className="text-sm font-semibold text-[#0F172A] mb-2">
              Revise and resubmit
            </div>
            <p className="text-sm text-[#374151] leading-relaxed mb-4 flex-1">
              Edit your draft and recheck against active rules.
            </p>
            <button
              type="button"
              onClick={onRevise}
              className="bg-white text-[#0F172A] font-mono text-sm font-medium px-4 py-2 rounded-sm border border-[#0F172A] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
            >
              Revise and resubmit →
            </button>
          </div>
        </div>
      )}

      {/* FIX 9 — CLEARED record block. "Governance record created"
          header, optional [Campaign Name] · prefix, "Checked against
          [N] rules · all passed" line, defaults variant. */}
      {isClear && (
        <div className="bg-[#0EA5E9]/5 border border-[#0EA5E9]/20 rounded p-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 w-7 h-7 rounded-full bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center"
              aria-hidden
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#166534"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#0F172A] mb-2">
                {campaignName ? `${campaignName} · ` : ""}Governance record
                created
              </div>
              <div className="text-xs text-[#475569] mb-2">
                {usedDefaults
                  ? "Checked against 5 ERA CUE default rules · all passed"
                  : `Checked against ${ruleCountChecked} rule${ruleCountChecked === 1 ? "" : "s"} · all passed`}
              </div>
              <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-xs">
                <dt className="font-mono text-[#64748B]">Record ID</dt>
                <dd className="font-mono text-[#0F172A] break-all">
                  {draftId ? `${draftId.slice(0, 8)}...` : "—"}
                </dd>
                <dt className="font-mono text-[#64748B]">SHA-256</dt>
                <dd className="font-mono text-[#0F172A] break-all">
                  {draftHash ? `${draftHash.slice(0, 16)}...` : "—"}
                </dd>
              </dl>
              <a
                href={draftId ? `/drafts/${draftId}/examiner` : "/review"}
                className="font-mono text-xs text-[#0EA5E9] hover:text-[#0369A1] transition-colors mt-3 inline-block"
              >
                View full record →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {draftId && (
          <a
            href={`/drafts/${draftId}/examiner`}
            className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1447C0] transition-colors"
          >
            See the communication record →
          </a>
        )}
        <button
          type="button"
          onClick={onReset}
          className="bg-white text-[#374151] font-mono text-sm font-medium px-5 py-2.5 rounded-sm border border-[#E2E8F0] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
        >
          Check another draft
        </button>
        {/* Ghost — block/escalate only. CLEAR new-user gets a separate
            invite link below the buttons instead. */}
        {isBlockOrEscalate && (
          <a
            href={ghostButton.href}
            className="font-mono text-sm text-[#64748B] hover:text-[#0F172A] transition-colors px-2 py-2.5"
          >
            {ghostButton.label} →
          </a>
        )}
      </div>

      {/* CLEAR + new_user only — invite team prompt */}
      {isClear && flow === "new_user" && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0] text-sm text-[#64748B]">
          Want to check more drafts faster?{" "}
          <a
            href="/onboarding/speakers"
            className="text-[#1A56DB] hover:text-[#1447C0] transition-colors"
          >
            Invite your team →
          </a>
        </div>
      )}
    </>
  );
}
