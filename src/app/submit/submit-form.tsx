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
          <div className="bg-white border border-[#E2E8F0] rounded-sm">
            <div className="p-5 border-b border-[#E2E8F0]">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
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
                className="w-full min-h-[260px] bg-transparent border-none resize-none text-[#0F172A] text-base leading-relaxed focus:outline-none placeholder:text-[#94A3B8]"
              />
            </div>
            <div className="px-5 py-3 flex justify-between items-center">
              <span className={`font-mono text-sm ${overLimit ? "text-[#B91C1C]" : "text-[#64748B]"}`}>
                {charCount} characters
              </span>
              {charLimit !== null ? (
                <span className={`font-mono text-sm ${overLimit ? "text-[#B91C1C]" : "text-[#64748B]"}`}>
                  / {charLimit.toLocaleString()} {currentChannel?.label}
                </span>
              ) : (
                <span className="font-mono text-sm text-[#94A3B8]">
                  No limit · {currentChannel?.label}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || overLimit}
            className="bg-[#0F172A] text-white text-base font-semibold w-full py-3.5 rounded-sm mt-3 hover:bg-[#1E293B] disabled:opacity-50 transition"
          >
            {submitting ? "Checking..." : "Check this draft →"}
          </button>

          {error && (
            <div className="font-mono text-xs text-[#B91C1C] mt-2">{error}</div>
          )}

          {/* Verdict reveal */}
          {verdictLower && verdictStyle && (
            <div className="mt-4 bg-white border border-[#E2E8F0] rounded-sm p-6 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
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
                    <div className="text-sm font-medium text-[#0F172A] mb-1">
                      {verdictData.ruleName}
                    </div>
                  )}
                  {verdictData.ruleDescription && (
                    <div className="text-xs text-[#64748B] mb-2">
                      {verdictData.ruleDescription}
                    </div>
                  )}
                  {verdictData.matchedKeyword && (
                    <span className="font-mono text-xs bg-[#F1F5F9] text-[#1A56DB] px-2 py-0.5 rounded-sm inline-block">
                      keyword: {verdictData.matchedKeyword}
                    </span>
                  )}
                </div>
              )}

              {/* Checks performed */}
              <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
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
                      <span className="font-mono text-xs text-[#0F172A]">{c.check_name}</span>
                      <span className="font-mono text-xs text-[#64748B]">{c.result.toUpperCase()}</span>
                      {c.detail && (
                        <span className="font-mono text-[10px] text-[#64748B]">· {c.detail}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Status line — block/escalate get an amber pending-review
                  tone; clear gets a green ready-to-publish tone. Replaces
                  the old muted notification so the resolution of the
                  verdict reads as the most important sentence in the
                  card. */}
              {isBlockOrEscalate && (
                <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="flex items-center gap-2 text-sm text-[#374151]">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" aria-hidden />
                    <span>
                      Pending principal review — Sarah Chen (GC) has been notified. Your draft will not publish until approved.
                    </span>
                  </div>
                </div>
              )}

              {verdictLower === "clear" && (
                <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
                  <div className="flex items-center gap-2 text-sm text-[#374151]">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] shrink-0" aria-hidden />
                    <span>
                      System cleared — no rule violations found. This draft is ready to publish.
                    </span>
                  </div>
                </div>
              )}

              {/* Verdict-specific next step */}
              {nextStep && (
                <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex items-center">
                  <Link
                    href={nextStep.href}
                    className={`font-mono text-xs ${
                      nextStep.tone === "green"
                        ? "text-[#166534] hover:text-[#0F4C2A]"
                        : "text-[#1A56DB] hover:text-[#1447C0]"
                    } transition-colors`}
                  >
                    {nextStep.label}
                  </Link>
                  <button
                    type="button"
                    onClick={checkAnother}
                    className="font-mono text-xs text-[#64748B] ml-4 cursor-pointer hover:text-[#0F172A] transition-colors"
                  >
                    Check another draft
                  </button>
                  {/* Block/escalate only: keep the draft text but clear the
                      verdict so the user can iterate on the wording without
                      retyping the body. */}
                  {isBlockOrEscalate && (
                    <button
                      type="button"
                      onClick={() => {
                        setVerdict(null);
                        setVerdictData(null);
                      }}
                      className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors cursor-pointer ml-4"
                    >
                      Edit and recheck →
                    </button>
                  )}
                </div>
              )}

              {/* Block / escalate routes the GC into the queue management flow.
                  Clear / review verdicts don't surface this nudge — those drafts
                  don't need triage. */}
              {isBlockOrEscalate && (
                <div className="mt-4 pt-4 border-t border-[#E2E8F0] text-center">
                  <Link
                    href="/dashboard"
                    className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
                  >
                    Go to dashboard to manage all pending reviews →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CONTEXT PANEL — desktop col-span-2, mobile first */}
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col gap-3">
          {/* Card 1 — Speaker */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SPEAKER
            </div>
            <div className="flex flex-col gap-2 mt-3 w-full">
              {SPEAKERS.map((s) => {
                const selected = speaker === s.name;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSpeaker(s.name)}
                    className={`w-full flex items-center justify-between px-3 py-3 rounded-sm border text-left transition-colors cursor-pointer min-h-[48px] ${
                      selected
                        ? "bg-[#EFF8FF] border-[#BAE6FD]"
                        : "bg-[#F8F9FB] border-[#E2E8F0] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    <span className="text-sm font-medium text-[#0F172A]">{s.name}</span>
                    <span className={`font-mono text-xs ${selected ? "text-[#1A56DB]" : "text-[#64748B]"}`}>
                      {s.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 2 — Channel */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              CHANNEL
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 w-full">
              {CHANNELS.map((c) => {
                const selected = channel === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setChannel(c.value)}
                    className={`py-3 px-2 rounded-sm border text-center transition-colors cursor-pointer font-mono text-xs uppercase tracking-wide min-h-[48px] flex items-center justify-center ${
                      selected
                        ? "bg-[#EFF8FF] border-[#BAE6FD] text-[#1447C0]"
                        : "bg-[#F8F9FB] border-[#E2E8F0] text-[#64748B] hover:bg-[#F1F5F9]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3 — Submission type */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              SUBMISSION TYPE
            </div>
            <div className="font-mono text-[10px] text-[#64748B] mt-0.5 mb-3">
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
                      selected ? "bg-[#EFF8FF] border-[#BAE6FD]" : "bg-white border-[#E2E8F0]"
                    }`}
                  >
                    {/* Inset shadow renders the inner white dot when selected — no
                        pseudo-elements needed. */}
                    <span
                      aria-hidden
                      className="w-4 h-4 rounded-full border-2 mt-0.5 shrink-0"
                      style={
                        selected
                          ? { backgroundColor: "#1A56DB", borderColor: "#1A56DB", boxShadow: "inset 0 0 0 3px white" }
                          : { borderColor: "#E2E8F0" }
                      }
                    />
                    <span>
                      <span className="block text-sm font-medium text-[#0F172A]">{opt.name}</span>
                      <span className="block text-xs text-[#374151] leading-relaxed">{opt.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {submissionType === "agent" && (
              <div className="font-mono text-xs text-[#C2410C] mt-1.5">
                FINRA 2026: ERA CUE principal review is consistent with FINRA&apos;s 2026 GenAI oversight guidance on human-in-the-loop checkpoints for agentic AI.
              </div>
            )}
            {/* Source citation for the FINRA 2026 framing above. Static —
                renders regardless of submission_type so the regulatory
                footing of this card stays visible. */}
            <div className="font-mono text-[10px] text-[#94A3B8] mt-3 pt-3 border-t border-[#E2E8F0]">
              FINRA 2026 Annual Regulatory Oversight Report — GenAI: Continuing and Emerging Trends.{" "}
              <a
                href="https://www.finra.org/rules-guidance/guidance/reports/2026-finra-annual-regulatory-oversight-report/gen-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1A56DB] hover:text-[#1447C0] transition-colors"
              >
                finra.org ↗
              </a>
            </div>
          </div>

          {/* Card 4 — EU AI Act declaration */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              EU AI ACT DECLARATION
            </div>
            <div className="font-mono text-[10px] text-[#64748B] mt-0.5 mb-3">
              Article 50 · AI content disclosure
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiDeclaration}
                onChange={(e) => setAiDeclaration(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-sm accent-[#1A56DB] cursor-pointer shrink-0"
              />
              <div>
                <div className="text-sm font-medium text-[#0F172A]">
                  This communication contains AI-generated content
                </div>
                <div className="text-xs text-[#64748B] mt-0.5">
                  {aiDeclaration
                    ? "Disclosure may be required at publication under EU AI Act Article 50"
                    : "No AI disclosure required — human-authored content declared"}
                </div>
              </div>
            </label>
          </div>

          {/* Card 4b — AI prompt logging (FINRA 2026). Only meaningful when
              AI involvement is declared, so the card hides itself otherwise. */}
          {aiDeclaration && (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
                AI PROMPT USED
              </div>
              <div className="font-mono text-[10px] text-[#94A3B8] mb-3">
                Optional · FINRA 2026 prompt logging requirement
              </div>
              <textarea
                value={promptUsed}
                onChange={(e) => setPromptUsed(e.target.value)}
                rows={3}
                placeholder="Paste the prompt used to generate this draft, if known. e.g. 'Write a LinkedIn post about our Series B growth plans for the CEO to post.'"
                className="w-full border border-[#E2E8F0] rounded-sm p-3 text-sm text-[#0F172A] bg-[#F8F9FB] resize-none focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono leading-relaxed placeholder:text-[#94A3B8]"
              />
              <div className="font-mono text-[10px] text-[#94A3B8] mt-2">
                Stored in the governance record per FINRA 2026 GenAI oversight guidance.
              </div>
            </div>
          )}

          {/* Card 5 — Campaign */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                CAMPAIGN
              </div>
              <div className="font-mono text-[10px] text-[#64748B]">Optional</div>
            </div>
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full border border-[#E2E8F0] rounded-sm bg-[#F8F9FB] text-sm text-[#0F172A] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            >
              {CAMPAIGNS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Card 6 — Agent submission API (coming soon) */}
          <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
                ERA CUE API
              </div>
              <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm">
                Coming soon
              </span>
            </div>
            <p className="text-xs text-[#64748B] mb-3 leading-relaxed">
              Connect ERA CUE to every tool in your communications stack.
              Outlook. Salesforce. Marketo. Your CMS. Any AI-generated
              content submits to ERA CUE before it publishes — automatically.
            </p>
            {/* Inline-styled <pre> with dangerouslySetInnerHTML — bypasses
                any downstream markdown / MDX processing of the JSX
                children that was occasionally swallowing the curly braces
                and quote marks. Quotes are HTML-entity-escaped so XSS is
                impossible (the payload is a fixed literal anyway). */}
            <pre
              style={{
                backgroundColor: "#0F172A",
                color: "#7DD3FC",
                fontFamily: "ui-monospace, monospace",
                fontSize: "11px",
                lineHeight: "1.6",
                padding: "12px",
                borderRadius: "4px",
                overflowX: "auto",
                whiteSpace: "pre",
                margin: "8px 0",
                display: "block",
              }}
              dangerouslySetInnerHTML={{
                __html: [
                  "POST https://api.eracue.com/v1/check",
                  "Authorization: Bearer {org_api_key}",
                  "X-ERA-CUE-WSP: &quot;Section 4.2&quot;",
                  "",
                  "{",
                  "  &quot;speaker&quot;: &quot;ceo&quot;,",
                  "  &quot;draft&quot;: &quot;...&quot;,",
                  "  &quot;channel&quot;: &quot;earnings_call&quot;,",
                  "  &quot;campaign&quot;: &quot;q2_2026&quot;,",
                  "  &quot;submission_type&quot;: &quot;agent&quot;,",
                  "  &quot;source&quot;: &quot;outlook_copilot&quot;",
                  "}",
                ].join("\n"),
              }}
            />
            <div className="font-mono text-[10px] text-[#94A3B8] mt-3 space-y-1">
              <div>✓ Rule inheritance by role and division</div>
              <div>✓ Campaign-scoped consistency checking</div>
              <div>✓ Regulator-format audit export</div>
              <div>✓ SOC 2 Type II (in progress)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
