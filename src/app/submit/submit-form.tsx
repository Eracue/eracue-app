"use client";

import { useState } from "react";
import Link from "next/link";
import { submitDraftAction } from "./actions";
import type { CheckEntry } from "@/lib/checks";

// ---------- Constants ----------------------------------------------------

const DEMO_DRAFT =
  "We're aggressively hiring across engineering and sales — excited to share more about our growth plans soon.";

const SPEAKERS = [
  { name: "Marcus Rivera", role: "CEO" },
  { name: "Lena Brooks",   role: "VP Comms" },
  { name: "James Kim",     role: "VP Sales" },
  { name: "Priya Patel",   role: "CMO" },
  { name: "Sarah Chen",    role: "GC" },
] as const;

const CHANNELS = [
  { value: "linkedin",      label: "LinkedIn",      limit: 3000 as number | null },
  { value: "twitter",       label: "X / Twitter",   limit: 280  as number | null },
  { value: "blog",          label: "Blog",          limit: null as number | null },
  { value: "press_release", label: "Press Release", limit: null as number | null },
  { value: "email",         label: "Email",         limit: null as number | null },
  { value: "other",         label: "Other",         limit: null as number | null },
] as const;

const CAMPAIGNS = [
  { value: "",                   label: "None" },
  { value: "Q3 Product Launch",  label: "Q3 Product Launch" },
  { value: "Series B Announce",  label: "Series B Announce" },
] as const;

const VERDICT_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  clear:    { bg: "bg-[#F0FDF4]", text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
  review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
};

type VerdictData = {
  ruleName?: string;
  ruleDescription?: string;
  matchedKeyword?: string;
  draftId?: string;
  checks?: CheckEntry[];
};

// ---------- Form ---------------------------------------------------------

export function SubmitForm() {
  const [draftText, setDraftText]           = useState(DEMO_DRAFT);
  const [speaker, setSpeaker]               = useState("Marcus Rivera");
  const [channel, setChannel]               = useState("linkedin");
  const [submissionType, setSubmissionType] = useState<"human" | "agent">("human");
  const [aiDeclaration, setAiDeclaration]   = useState(true);
  const [promptUsed, setPromptUsed]         = useState("");
  const [campaign, setCampaign]             = useState("Series B Announce");
  const [charCount, setCharCount]           = useState(DEMO_DRAFT.length);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [verdict, setVerdict]               = useState<string | null>(null);
  const [verdictData, setVerdictData]       = useState<VerdictData | null>(null);

  const currentChannel = CHANNELS.find((c) => c.value === channel);
  const charLimit = currentChannel?.limit ?? null;
  const overLimit = charLimit !== null && charCount > charLimit;

  async function handleSubmit() {
    if (!draftText.trim()) {
      setError("Please enter a draft.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setVerdict(null);
    setVerdictData(null);

    try {
      const result = await submitDraftAction({
        draftText,
        speakerName: speaker,
        channel,
        sourceOrigin: aiDeclaration ? "ai_assisted" : "human",
        submissionType,
        campaignName: campaign || null,
        // Only meaningful when AI is declared; the action ignores empty values.
        promptUsed: aiDeclaration ? promptUsed : undefined,
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      // Narrow to the success branch (the only branch with verdict/draftId).
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
      setSubmitting(false);
    }
  }

  function checkAnother() {
    setVerdict(null);
    setVerdictData(null);
    setDraftText("");
    setCharCount(0);
    setError(null);
  }

  const verdictLower = verdict?.toLowerCase() ?? null;
  const verdictStyle = verdictLower ? VERDICT_STYLES[verdictLower] ?? VERDICT_STYLES.clear : null;
  const isBlockOrEscalate = verdictLower === "block" || verdictLower === "escalate";
  const checksToShow: CheckEntry[] = verdictData?.checks ?? [];

  // Verdict-specific next-step link
  function nextStepLink(): { href: string; label: string; tone: "indigo" | "green" } | null {
    if (!verdictLower || !verdictData?.draftId) return null;
    const id = verdictData.draftId;
    if (verdictLower === "block")    return { href: `/reviewer/${id}`,         label: "View review →",                tone: "indigo" };
    if (verdictLower === "escalate") return { href: `/reviewer/${id}`,         label: "Open review →",                tone: "indigo" };
    if (verdictLower === "clear")    return { href: `/drafts/${id}/examiner`,  label: "Download approval record →",   tone: "green"  };
    return                                  { href: `/drafts/${id}`,           label: "View details →",               tone: "indigo" };
  }
  const nextStep = nextStepLink();

  return (
    <div className="max-w-[1100px] mx-auto px-6 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* DRAFT WORKSPACE — desktop col-span-3, mobile second */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <div className="bg-white border border-[#E2E1DC] rounded-sm">
            <div className="p-5 border-b border-[#E2E1DC]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-3">
                DRAFT TEXT
              </div>
              <textarea
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  setCharCount(e.target.value.length);
                }}
                rows={8}
                placeholder="Paste the exact draft text that will be published..."
                className="w-full bg-transparent border-none resize-none text-[#1C1C1A] text-base leading-relaxed focus:outline-none placeholder:text-[#9E9E96]"
              />
            </div>
            <div className="px-5 py-3 flex justify-between items-center">
              <span className={`font-mono text-xs ${overLimit ? "text-[#B91C1C]" : "text-[#6E6E68]"}`}>
                {charCount} characters
              </span>
              {charLimit !== null ? (
                <span className={`font-mono text-xs ${overLimit ? "text-[#B91C1C]" : "text-[#6E6E68]"}`}>
                  / {charLimit.toLocaleString()} {currentChannel?.label}
                </span>
              ) : (
                <span className="font-mono text-xs text-[#9E9E96]">
                  No limit · {currentChannel?.label}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || overLimit}
            className="bg-[#1C1C1A] text-white text-sm font-medium w-full py-3 rounded-sm mt-3 hover:bg-[#333331] disabled:opacity-50 transition"
          >
            {submitting ? "Checking..." : "Check this draft →"}
          </button>

          {error && (
            <div className="font-mono text-xs text-[#B91C1C] mt-2">{error}</div>
          )}

          {/* Verdict reveal */}
          {verdictLower && verdictStyle && (
            <div className="mt-4 bg-white border border-[#E2E1DC] rounded-sm p-6 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-2">
                    SYSTEM VERDICT
                  </div>
                  <span
                    className={`font-mono text-sm font-bold px-4 py-2 rounded-sm border uppercase tracking-widest inline-flex ${verdictStyle.bg} ${verdictStyle.text} ${verdictStyle.border}`}
                  >
                    {verdictStyle.label}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[#166534] flex items-center gap-1">
                  ✓ Record generated
                </div>
              </div>

              {isBlockOrEscalate && verdictData && (
                <div>
                  {verdictData.ruleName && (
                    <div className="text-sm font-medium text-[#1C1C1A] mb-1">
                      {verdictData.ruleName}
                    </div>
                  )}
                  {verdictData.ruleDescription && (
                    <div className="text-xs text-[#6E6E68] mb-2">
                      {verdictData.ruleDescription}
                    </div>
                  )}
                  {verdictData.matchedKeyword && (
                    <span className="font-mono text-xs bg-[#F0EFE9] text-[#C9A92C] px-2 py-0.5 rounded-sm inline-block">
                      keyword: {verdictData.matchedKeyword}
                    </span>
                  )}
                </div>
              )}

              {/* Checks performed */}
              <div className="mt-4 pt-4 border-t border-[#E2E1DC]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-3">
                  CHECKS PERFORMED
                </div>
                {checksToShow.map((c, i) => {
                  const dot =
                    c.result === "fail" ? "bg-[#B91C1C]" :
                    c.result === "warn" ? "bg-[#C2410C]" :
                                          "bg-[#166534]";
                  return (
                    <div
                      key={`${c.check_name}-${i}`}
                      className="flex items-center gap-2 py-1"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} aria-hidden />
                      <span className="font-mono text-xs text-[#1C1C1A]">{c.check_name}</span>
                      <span className="font-mono text-xs text-[#6E6E68]">{c.result.toUpperCase()}</span>
                      {c.detail && (
                        <span className="font-mono text-[10px] text-[#6E6E68]">· {c.detail}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Notification line — block or escalate only */}
              {isBlockOrEscalate && (
                <div className="mt-4 pt-4 border-t border-[#E2E1DC] flex items-center gap-2 font-mono text-xs text-[#6E6E68]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  Sarah Chen (GC) notified — draft is in the reviewer queue
                </div>
              )}

              {/* Verdict-specific next step */}
              {nextStep && (
                <div className="mt-4 pt-4 border-t border-[#E2E1DC] flex items-center">
                  <Link
                    href={nextStep.href}
                    className={`font-mono text-xs ${
                      nextStep.tone === "green"
                        ? "text-[#166534] hover:text-[#0F4C2A]"
                        : "text-[#4F46E5] hover:text-[#3730A3]"
                    } transition-colors`}
                  >
                    {nextStep.label}
                  </Link>
                  <button
                    type="button"
                    onClick={checkAnother}
                    className="font-mono text-xs text-[#6E6E68] ml-4 cursor-pointer hover:text-[#1C1C1A] transition-colors"
                  >
                    Check another draft
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTEXT PANEL — desktop col-span-2, mobile first */}
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col gap-3">
          {/* Card 1 — Speaker */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              SPEAKER
            </div>
            <div className="flex flex-col gap-1.5 mt-3">
              {SPEAKERS.map((s) => {
                const selected = speaker === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSpeaker(s.name)}
                    className={`flex justify-between items-center w-full px-3 py-2 rounded-sm border transition-colors ${
                      selected
                        ? "bg-[#EEF2FF] border-[#C7D2FE]"
                        : "bg-[#F7F6F3] border-[#E2E1DC] hover:bg-[#F0EFE9]"
                    }`}
                  >
                    <span className="text-xs font-medium text-[#1C1C1A]">{s.name}</span>
                    <span className={`font-mono text-[10px] ${selected ? "text-[#6366F1]" : "text-[#6E6E68]"}`}>
                      {s.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 2 — Channel */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              CHANNEL
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {CHANNELS.map((c) => {
                const selected = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={`text-center py-2 px-1 rounded-sm border font-mono text-[10px] uppercase tracking-wide transition-colors ${
                      selected
                        ? "bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]"
                        : "bg-[#F7F6F3] border-[#E2E1DC] text-[#6E6E68] hover:bg-[#F0EFE9]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3 — Submission type */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              SUBMISSION TYPE
            </div>
            <div className="font-mono text-[10px] text-[#6E6E68] mt-0.5 mb-3">
              Required · FINRA agentic AI guidance 2026
            </div>
            <div className="flex flex-col">
              {[
                {
                  value: "human" as const,
                  name: "Human submitted",
                  desc: "A person is submitting this draft. AI may have assisted in drafting.",
                },
                {
                  value: "agent" as const,
                  name: "Agent submitted",
                  desc: "An automated system drafted and submitted this. ERA CUE review is the required human checkpoint.",
                },
              ].map((opt) => {
                const selected = submissionType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSubmissionType(opt.value)}
                    className={`flex items-start gap-3 py-3 px-3 border rounded-sm mb-1.5 text-left w-full transition-colors ${
                      selected ? "bg-[#EEF2FF] border-[#C7D2FE]" : "bg-white border-[#E2E1DC]"
                    }`}
                  >
                    {/* Inset shadow renders the inner white dot when selected — no
                        pseudo-elements needed. */}
                    <span
                      aria-hidden
                      className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0"
                      style={
                        selected
                          ? { backgroundColor: "#4F46E5", borderColor: "#4F46E5", boxShadow: "inset 0 0 0 3px white" }
                          : { borderColor: "#E2E1DC" }
                      }
                    />
                    <span>
                      <span className="block text-xs font-medium text-[#1C1C1A]">{opt.name}</span>
                      <span className="block font-mono text-[10px] text-[#6E6E68] leading-relaxed">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {submissionType === "agent" && (
              <div className="font-mono text-[10px] text-[#C2410C] mt-1.5">
                FINRA 2026: ERA CUE principal review satisfies the supervision requirement for agentic AI communications.
              </div>
            )}
          </div>

          {/* Card 4 — EU AI Act declaration */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              EU AI ACT DECLARATION
            </div>
            <div className="font-mono text-[10px] text-[#6E6E68] mt-0.5 mb-3">
              Article 50 · AI content disclosure
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiDeclaration}
                onChange={(e) => setAiDeclaration(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-sm accent-[#4F46E5] cursor-pointer shrink-0"
              />
              <div>
                <div className="text-xs font-medium text-[#1C1C1A]">
                  This communication contains AI-generated content
                </div>
                <div className="font-mono text-[10px] text-[#6E6E68] mt-0.5">
                  Disclosure required at publication under EU AI Act Article 50
                </div>
              </div>
            </label>
            {!aiDeclaration && (
              <div className="font-mono text-[10px] text-[#6E6E68] mt-2">
                Human-authored content — no AI disclosure required
              </div>
            )}
          </div>

          {/* Card 4b — AI prompt logging (FINRA 2026). Only meaningful when
              AI involvement is declared, so the card hides itself otherwise. */}
          {aiDeclaration && (
            <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-1">
                AI PROMPT USED
              </div>
              <div className="font-mono text-[10px] text-[#9E9E96] mb-3">
                Optional · FINRA 2026 prompt logging requirement
              </div>
              <textarea
                value={promptUsed}
                onChange={(e) => setPromptUsed(e.target.value)}
                rows={3}
                placeholder="Paste the prompt used to generate this draft, if known. e.g. 'Write a LinkedIn post about our Series B growth plans for the CEO to post.'"
                className="w-full border border-[#E2E1DC] rounded-sm p-3 text-xs text-[#1C1C1A] bg-[#F7F6F3] resize-none focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono leading-relaxed placeholder:text-[#9E9E96]"
              />
              <div className="font-mono text-[10px] text-[#9E9E96] mt-2">
                Stored in the governance record per FINRA 2026 GenAI oversight guidance.
              </div>
            </div>
          )}

          {/* Card 5 — Campaign */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                CAMPAIGN
              </div>
              <div className="font-mono text-[10px] text-[#6E6E68]">Optional</div>
            </div>
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full border border-[#E2E1DC] rounded-sm bg-[#F7F6F3] text-sm text-[#1C1C1A] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            >
              {CAMPAIGNS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Card 6 — Agent submission API (coming soon) */}
          <div className="bg-[#F7F6F3] border border-[#E2E1DC] rounded-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                ERA CUE API
              </div>
              <span className="font-mono text-[10px] bg-[#F0EFE9] text-[#6E6E68] border border-[#E2E1DC] px-2 py-0.5 rounded-sm">
                Coming soon
              </span>
            </div>
            <p className="text-xs text-[#6E6E68] mb-3 leading-relaxed">
              When AI agents draft and publish on behalf of your executives, ERA CUE becomes the required human checkpoint — satisfying FINRA&apos;s 2026 agentic AI supervision requirement.
            </p>
            <pre className="bg-[#1C1C1A] text-[#A5B4FC] font-mono text-[10px] leading-relaxed p-3 rounded-sm overflow-x-auto">
{`POST https://api.eracue.com/v1/check
Authorization: Bearer YOUR_KEY

{
  "speaker": "ceo",
  "draft": "...",
  "channel": "linkedin",
  "submission_type": "agent"
}`}
            </pre>
            <p className="font-mono text-[10px] text-[#9E9E96] mt-2">
              Agent submissions automatically route to principal review. No agent post goes live without ERA CUE clearance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
