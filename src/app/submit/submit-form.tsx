"use client";

import { useState } from "react";
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

type Props = {
  flow: SubmitFlow;
  fromRules: boolean;
  activatedCount: number;
  firmType: string;
  speakers: SpeakerInfo[];
  ruleCount: number;
  corpusCount: number;
  currentUserName: string | null;
  isDemoMode: boolean;
};

type VerdictData = {
  ruleName?: string;
  ruleDescription?: string;
  matchedKeyword?: string;
  draftId?: string;
  checks?: CheckEntry[];
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

// Example draft surfaced behind the "Try an example →" link in demo
// mode. Trips the Series B Quiet Period rule on the keywords
// "expanding" and "fundraising" so a visitor sees a BLOCK verdict
// the moment they click through.
const DEMO_EXAMPLE_DRAFT =
  "We're aggressively expanding our team and excited to share updates on our fundraising progress soon.";

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

// ---------- Form ---------------------------------------------------------

export function SubmitForm({
  flow,
  fromRules,
  activatedCount,
  firmType,
  speakers,
  ruleCount,
  corpusCount,
  currentUserName,
  isDemoMode,
}: Props) {
  // corpusCount is preserved on the props contract for the page
  // component but no longer surfaces in the UI — the new
  // three-line CheckingState narrative is static.
  void corpusCount;
  // Initial speaker — preference order:
  //   1. The current user (if they exist as a speaker)
  //   2. Marcus Rivera (CEO) in demo mode — the canonical demo submitter
  //   3. The first speaker in the list
  //   4. null (new-user flow with no speakers)
  const initialSpeaker: SpeakerInfo | null =
    speakers.find((s) => s.is_current_user) ??
    (flow === "demo"
      ? (speakers.find((s) => s.display_name === "Marcus Rivera") ?? null)
      : null) ??
    speakers[0] ??
    null;

  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(
    initialSpeaker?.id ?? null,
  );
  const [showAllSpeakers, setShowAllSpeakers] = useState(false);
  const [channel, setChannel] = useState<string>("linkedin");
  const [draftText, setDraftText] = useState("");
  // Campaign is visible by default; demo flow pre-selects "Series B" so
  // the first-time visitor sees a fully-populated submission.
  const [campaign, setCampaign] = useState(flow === "demo" ? "Series B" : "");
  // Submission origin — submission_method is read-only "web app" in this
  // surface; aiInvolvement is the EU AI Act / FINRA disclosure checkbox.
  const submissionMethod = "web app";
  const [aiInvolvement, setAiInvolvement] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingStage, setCheckingStage] = useState<0 | 1 | 2>(0);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null);
  // firmType is no longer used to route the example — the demo flow
  // shows a single canonical draft. Reference the variable so an
  // unused-prop lint never flags the page→form contract.
  void firmType;

  const exampleDraft = DEMO_EXAMPLE_DRAFT;

  // For new-user with zero speakers — we still render a "Yourself"
  // card in the speaker section, but submission against the action
  // requires a matching `users.name` row. Submit is gated server-
  // side; we keep the button enabled and surface the error inline
  // if the lookup fails.
  const selectedSpeaker =
    speakers.find((s) => s.id === selectedSpeakerId) ?? null;

  const speakerNameForSubmit =
    selectedSpeaker?.display_name ?? currentUserName ?? "";

  // Speakers visible in the grid before the user clicks "+ N more".
  // For more than six speakers we collapse the grid to the first
  // six so the page doesn't scroll on a normal viewport.
  const displaySpeakers =
    showAllSpeakers || speakers.length <= 6
      ? speakers
      : speakers.slice(0, 6);

  async function handleSubmit() {
    if (!draftText.trim()) {
      setError("Please enter a draft.");
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
        campaignName: campaign.trim() || null,
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
    setAiInvolvement(false);
    setError(null);
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
      : { href: "/dashboard", label: "Go to review queue" };

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

      {flow === "new_user" && (
        <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm p-4 mb-6 flex items-start gap-3">
          <span className="text-[#1A56DB] shrink-0 text-base mt-0.5" aria-hidden>
            →
          </span>
          <div>
            <div className="text-sm font-medium text-[#0F172A] mb-0.5">
              {ruleCount > 0
                ? `${ruleCount} rule${ruleCount !== 1 ? "s" : ""} are active.`
                : "No rules configured yet."}
            </div>
            <div className="text-sm text-[#64748B]">
              {ruleCount > 0
                ? "ERA CUE will check this draft against your active rules."
                : "ERA CUE will run its standard checks. Set up governance rules to add your own policies."}
              {ruleCount === 0 && (
                <a
                  href="/rules"
                  className="text-[#1A56DB] hover:text-[#1447C0] ml-1 transition-colors"
                >
                  Set up rules →
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Page header — step indicator + title + flow-aware sub ──── */}
      <div className="mb-6">
        {fromRules && (
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Step 2 of 3 — Check a draft
          </div>
        )}
        <h1
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="text-3xl font-light text-[#0F172A] mb-2"
        >
          Does this draft clear your governance rules?
        </h1>
        <p className="text-sm text-[#64748B] leading-relaxed max-w-lg">
          {flow === "demo"
            ? "ERA CUE checks it against active governance rules and prior approved statements. Verdict in seconds."
            : flow === "new_user"
              ? "ERA CUE runs five checks on every draft. Set up rules to add your organization’s specific policies."
              : `ERA CUE checks against your ${ruleCount} active rule${ruleCount !== 1 ? "s" : ""} and prior approved statements.`}
        </p>
      </div>

      {/* ─── Body — three modes (form / checking / verdict) ─────────── */}
      {checking ? (
        <CheckingState stage={checkingStage} />
      ) : verdictLower && verdictMeta ? (
        <VerdictView
          verdictKey={verdictLower}
          meta={verdictMeta}
          data={verdictData}
          isBlockOrEscalate={isBlockOrEscalate}
          flow={flow}
          ghostButton={ghostButton}
          onReset={handleReset}
        />
      ) : (
        <FormBody
          flow={flow}
          speakers={speakers}
          displaySpeakers={displaySpeakers}
          showAllSpeakers={showAllSpeakers}
          setShowAllSpeakers={setShowAllSpeakers}
          selectedSpeakerId={selectedSpeakerId}
          setSelectedSpeakerId={setSelectedSpeakerId}
          currentUserName={currentUserName}
          channel={channel}
          setChannel={setChannel}
          draftText={draftText}
          setDraftText={setDraftText}
          campaign={campaign}
          setCampaign={setCampaign}
          submissionMethod={submissionMethod}
          aiInvolvement={aiInvolvement}
          setAiInvolvement={setAiInvolvement}
          isDemoMode={isDemoMode}
          exampleDraft={exampleDraft}
          ruleCount={ruleCount}
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
  currentUserName,
  channel,
  setChannel,
  draftText,
  setDraftText,
  campaign,
  setCampaign,
  submissionMethod,
  aiInvolvement,
  setAiInvolvement,
  isDemoMode,
  exampleDraft,
  ruleCount,
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
  currentUserName: string | null;
  channel: string;
  setChannel: (v: string) => void;
  draftText: string;
  setDraftText: (v: string) => void;
  campaign: string;
  setCampaign: (v: string) => void;
  submissionMethod: string;
  aiInvolvement: boolean;
  setAiInvolvement: (v: boolean) => void;
  isDemoMode: boolean;
  exampleDraft: string;
  ruleCount: number;
  checking: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const submitDisabled =
    !draftText.trim() ||
    (speakers.length > 0 && !selectedSpeakerId) ||
    (flow === "new_user" && speakers.length === 0 && !currentUserName) ||
    checking;

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
          {flow === "new_user" && speakers.length === 0 ? (
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
                  const selected = selectedSpeakerId === speaker.id;
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

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={aiInvolvement}
              onChange={(e) => setAiInvolvement(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1A56DB] cursor-pointer"
            />
            <span>
              <span className="block text-sm text-[#0F172A]">
                This draft included AI assistance.
              </span>
              <span className="block text-xs text-[#64748B] mt-1 leading-relaxed">
                ERA CUE records what is declared. Disclosure obligations
                should be confirmed with qualified legal counsel.
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
              onClick={() => setDraftText(exampleDraft)}
              className="font-mono text-[10px] text-[#1A56DB] hover:text-[#1447C0] transition-colors cursor-pointer"
            >
              Try an example →
            </button>
          )}
        </div>

        <div className="p-4">
          <textarea
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
            {isDemoMode
              ? "4 governance rules active"
              : ruleCount > 0
                ? `${ruleCount} governance rule${ruleCount !== 1 ? "s" : ""} active`
                : "Standard governance checks will run"}
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
}: {
  stage: 0 | 1 | 2;
}) {
  // Three-line progressive narrative. Each line lights up in sequence
  // (800ms apart, driven by setCheckingStage) so the visitor reads the
  // governance pipeline running in real time rather than staring at a
  // spinner.
  const lines: ReadonlyArray<{ text: string; stage: 0 | 1 | 2 }> = [
    {
      text: "Checking against 4 active governance rules...",
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
}: {
  verdictKey: string;
  meta: { label: string; headerBg: string; headerBorder: string; badgeBg: string };
  data: VerdictData | null;
  isBlockOrEscalate: boolean;
  flow: SubmitFlow;
  ghostButton: { href: string; label: string };
  onReset: () => void;
}) {
  const draftId = data?.draftId;
  const checks = data?.checks ?? [];
  const isClear = verdictKey === "clear";

  return (
    <>
      {/* Verdict card — header carries the plain-English label + rule
          context; body lists the checks that ran. */}
      <div className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden mb-4">
        <div className={`px-5 py-4 border-b ${meta.headerBg} ${meta.headerBorder}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`font-mono text-xs font-bold uppercase px-2.5 py-1 rounded-sm border ${meta.badgeBg}`}
            >
              {meta.label}
            </span>
            {data?.ruleName && (
              <span className="text-sm font-medium text-[#0F172A]">
                {data.ruleName}
              </span>
            )}
          </div>
          {data?.matchedKeyword && (
            <div className="font-mono text-[10px] text-[#64748B] mt-2">
              Keyword: &ldquo;{data.matchedKeyword}&rdquo;
              {data.ruleDescription && (
                <span> · {data.ruleDescription}</span>
              )}
            </div>
          )}
        </div>

        {checks.length > 0 && (
          <div className="px-5 py-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              Checks performed
            </div>
            <div className="space-y-1">
              {checks.map((c, i) => {
                const dot =
                  c.result === "fail"
                    ? "bg-[#B91C1C]"
                    : c.result === "warn"
                      ? "bg-[#C2410C]"
                      : "bg-[#166534]";
                return (
                  <div
                    key={`${c.check_name}-${i}`}
                    className="flex items-center gap-2 py-1"
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${dot}`}
                      aria-hidden
                    />
                    <span className="font-mono text-xs text-[#0F172A]">
                      {c.check_name}
                    </span>
                    <span className="font-mono text-xs text-[#64748B]">
                      {c.result.toUpperCase()}
                    </span>
                    {c.detail && (
                      <span className="font-mono text-[10px] text-[#64748B]">
                        · {c.detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* What happens next — block/escalate gets a three-step flow,
          clear gets a two-line "you can publish" framing. */}
      {isBlockOrEscalate && (
        <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-5 mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-4">
            What happens next
          </div>
          <div className="space-y-4">
            {[
              {
                n: "1",
                title: "Routes to principal review.",
                sub: "The principal sees the full check chain and makes a structured decision.",
              },
              {
                n: "2",
                title: "A communication record is created permanently.",
                sub: "SHA-256 locked. Includes this verdict and the principal’s decision.",
              },
              {
                n: "3",
                title: "Do not publish until approved.",
                sub: "Publishing before approval bypasses your governance and creates regulatory exposure.",
              },
            ].map((item) => (
              <div key={item.n} className="flex items-start gap-3">
                <span className="font-mono text-sm font-bold text-[#1A56DB] w-5 shrink-0 mt-0.5">
                  {item.n}
                </span>
                <div>
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">
                    {item.title}
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    {item.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isClear && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-sm p-5 mb-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-4">
            Cleared for publication
          </div>
          <div className="space-y-3">
            {[
              {
                title: "All five checks passed. You can publish this draft.",
                sub: "A communication record has been created with this verdict.",
              },
              {
                title: "The record is SHA-256 locked and permanent.",
                sub: "This proves ERA CUE checked this draft before it was published.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <span
                  className="text-[#166534] font-bold mt-0.5"
                  aria-hidden
                >
                  ✓
                </span>
                <div>
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">
                    {item.title}
                  </div>
                  <div className="font-mono text-[10px] text-[#64748B]">
                    {item.sub}
                  </div>
                </div>
              </div>
            ))}
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
