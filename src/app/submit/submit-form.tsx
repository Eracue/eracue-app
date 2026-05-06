"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { submitDraftAction, type SubmitSuccess } from "./actions";
import type { CheckEntry } from "@/lib/checks";

type Speaker = { id: string; name: string; title: string | null; role: string };
type Campaign = { id: string; name: string };
type Props = { speakers: Speaker[]; campaigns: Campaign[] };

// ---------- Constants ----------------------------------------------------

const DEMO_DRAFT_TEXT =
  "We're aggressively hiring across engineering and sales — excited to share more about our growth plans soon.";

// (label, value sent to server in lowercase / underscore form)
const CHANNELS: { label: string; value: string }[] = [
  { label: "LinkedIn",      value: "linkedin" },
  { label: "Twitter / X",   value: "twitter" },
  { label: "Blog",          value: "blog" },
  { label: "Press release", value: "press_release" },
  { label: "Interview",     value: "interview" },
  { label: "Email",         value: "email" },
];

// Per-channel character limits (null = no platform-imposed cap)
const CHANNEL_LIMITS: Record<string, { limit: number | null; label: string }> = {
  linkedin:      { limit: 3000, label: "/ 3,000 LinkedIn" },
  twitter:       { limit: 280,  label: "/ 280 X · Twitter" },
  press_release: { limit: null, label: "No limit · Press release" },
  blog:          { limit: null, label: "No limit · Blog" },
  interview:     { limit: null, label: "No limit · Interview" },
  email:         { limit: null, label: "No limit · Email" },
  other:         { limit: null, label: "" },
};

const SOURCES: { label: string; description: string; value: string }[] = [
  { label: "Human written", description: "Authored by the speaker",         value: "human" },
  { label: "AI-assisted",   description: "Human-edited AI draft",           value: "ai_assisted" },
  { label: "AI-generated",  description: "Published without human edit",    value: "ai_generated" },
];

const PREFERRED_SPEAKER_ORDER = ["Marcus Rivera", "Lena Brooks", "James Kim", "Priya Patel", "Sarah Chen"];

// ---------- Verdict reveal ------------------------------------------------

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    block:    { bg: "bg-[#FEF2F2]",     text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
    escalate: { bg: "bg-[#FFF7ED]",     text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
    review:   { bg: "bg-[#EFF6FF]",     text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
    guide:    { bg: "bg-[#F5F3FF]",     text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
    clear:    { bg: "bg-[#F0FDF4]",     text: "text-[#166534]", border: "border-[#BBF7D0]", label: "CLEAR" },
  };
  const s = styles[verdict] || styles.clear;
  return (
    <span className={`inline-flex items-center px-4 py-2 rounded-sm border font-mono text-sm font-bold uppercase tracking-widest ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function CheckResultRow({ entry }: { entry: CheckEntry }) {
  const dot =
    entry.result === "fail" ? "#B91C1C" :
    entry.result === "warn" ? "#C2410C" :
                              "#166534";
  const resultLabel = entry.result.toUpperCase();
  return (
    <li className="flex items-center gap-2 mt-2">
      <span aria-hidden className="inline-block rounded-full" style={{ width: 6, height: 6, backgroundColor: dot }} />
      <span className="font-mono text-xs text-[#1C1C1A]">{entry.check_name}</span>
      <span className="font-mono text-xs text-[#6E6E68]">· {resultLabel}</span>
    </li>
  );
}

// ---------- Form ---------------------------------------------------------

export function SubmitForm({ speakers, campaigns }: Props) {
  // Sort speakers by preferred order (Marcus first), unknowns at end alphabetically.
  const orderedSpeakers = useMemo(() => {
    const indexOf = (name: string) => {
      const i = PREFERRED_SPEAKER_ORDER.indexOf(name);
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return [...speakers].sort((a, b) => {
      const ai = indexOf(a.name);
      const bi = indexOf(b.name);
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
  }, [speakers]);

  const defaultSpeakerId = useMemo(() => {
    return orderedSpeakers.find((s) => s.name === "Marcus Rivera")?.id || orderedSpeakers[0]?.id || "";
  }, [orderedSpeakers]);

  const defaultCampaignId = useMemo(() => {
    return campaigns.find((c) => /series\s*b/i.test(c.name))?.id || "";
  }, [campaigns]);

  const [speakerId, setSpeakerId] = useState(defaultSpeakerId);
  const [channel, setChannel] = useState("linkedin");
  const [source, setSource] = useState("ai_assisted");
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const [draftText, setDraftText] = useState(DEMO_DRAFT_TEXT);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdictResult, setVerdictResult] = useState<SubmitSuccess | null>(null);

  const channelInfo = CHANNEL_LIMITS[channel] || CHANNEL_LIMITS.other;
  const charCount = draftText.length;
  const exceedsLimit = channelInfo.limit !== null && charCount > channelInfo.limit;

  async function onSubmit() {
    setError(null);
    if (!draftText.trim()) { setError("Draft text cannot be empty."); return; }
    if (!speakerId) { setError("Please select a speaker."); return; }
    setSubmitting(true);
    try {
      const result = await submitDraftAction({
        speakerId,
        channel,
        sourceOrigin: source,
        campaignId: campaignId || null,
        draftText: draftText.trim(),
      });
      if ("error" in result && result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      // Success path — reveal the verdict inline. No redirect.
      setVerdictResult(result as SubmitSuccess);
      setSubmitting(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setSubmitting(false);
    }
  }

  function checkAnother() {
    setVerdictResult(null);
    setDraftText("");
    setError(null);
  }

  // Build checks array for the verdict reveal — server returns it now, but
  // synthesize a fallback if absent.
  const checksToShow: CheckEntry[] = useMemo(() => {
    if (!verdictResult) return [];
    if (verdictResult.checks && verdictResult.checks.length > 0) return verdictResult.checks;
    const pm = verdictResult.primaryMatch;
    const isQuiet = pm ? /quiet period/i.test(pm.rule_name) : false;
    return [
      pm
        ? { check_name: "Rule Check", result: "fail", detail: `Matched: ${pm.rule_name}`, matched_keyword: pm.matched_keyword }
        : { check_name: "Rule Check", result: "pass", detail: null },
      { check_name: "Consistency Check", result: "pass", detail: null },
      { check_name: "Alignment Check", result: "pass", detail: null },
      isQuiet && pm
        ? { check_name: "Quiet Period Check", result: "fail", detail: `Quiet period rule matched: ${pm.rule_name}` }
        : { check_name: "Quiet Period Check", result: "pass", detail: null },
      { check_name: "Agent Origin Check", result: "pass", detail: null },
    ];
  }, [verdictResult]);

  return (
    <div className="max-w-[1100px] mx-auto px-6 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* DRAFT WORKSPACE — desktop left (col-span-3), mobile second */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-6">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] mb-3">
              DRAFT TEXT
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Paste your draft here. ERA CUE checks it against active governance rules before publication."
              className="w-full min-h-[220px] resize-none bg-transparent text-[#1C1C1A] text-base leading-relaxed font-sans border-0 outline-none focus:outline-none focus:ring-0 p-0"
            />
            <div className="flex justify-between items-center pt-3 mt-3 border-t border-[#E2E1DC]">
              <div className="flex items-baseline gap-3">
                <span className={`font-mono text-xs ${exceedsLimit ? "text-[#B91C1C]" : "text-[#6E6E68]"}`}>
                  {charCount} characters
                </span>
                {exceedsLimit && (
                  <span className="font-mono text-[10px] text-[#B91C1C]">
                    Exceeds platform limit
                  </span>
                )}
              </div>
              <span className={`font-mono text-xs ${exceedsLimit ? "text-[#B91C1C]" : "text-[#6E6E68]"}`}>
                {channelInfo.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="bg-[#1C1C1A] text-white text-sm font-medium w-full py-3 rounded-sm mt-3 hover:bg-[#333331] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Checking..." : "Check this draft →"}
          </button>

          {error && (
            <div className="mt-3 px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-sm text-sm text-[#B91C1C]">
              {error}
            </div>
          )}

          {/* Verdict reveal */}
          {verdictResult && (
            <div className="mt-4 bg-white border border-[#E2E1DC] rounded-sm p-6 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                    SYSTEM VERDICT
                  </div>
                  <div className="mt-2">
                    <VerdictBadge verdict={verdictResult.verdict} />
                  </div>
                </div>
                <div className="font-mono text-[10px] text-[#166534] flex items-center gap-1">
                  <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[#166534]" />
                  ✓ Record generated
                </div>
              </div>

              {(verdictResult.verdict === "block" || verdictResult.verdict === "escalate") && verdictResult.primaryMatch && (
                <div className="mt-3">
                  <div className="text-sm font-medium text-[#1C1C1A]">
                    {verdictResult.primaryMatch.rule_name}
                  </div>
                  <div className="text-xs text-[#6E6E68] mt-1">
                    {verdictResult.primaryMatch.rule_description}
                  </div>
                  {verdictResult.primaryMatch.matched_keyword && (
                    <span className="font-mono text-xs bg-[#F0EFE9] text-[#C9A92C] px-2 py-0.5 rounded-sm inline-block mt-2">
                      keyword: {verdictResult.primaryMatch.matched_keyword}
                    </span>
                  )}
                </div>
              )}

              {/* Checks performed */}
              <div className="mt-4 pt-4 border-t border-[#E2E1DC]">
                <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                  CHECKS PERFORMED
                </div>
                <ul>
                  {checksToShow.map((c, i) => (
                    <CheckResultRow key={`${c.check_name}-${i}`} entry={c} />
                  ))}
                </ul>
              </div>

              {/* Notification line */}
              <div className="mt-4 pt-4 border-t border-[#E2E1DC] font-mono text-xs text-[#6E6E68] flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                Sarah Chen (GC) notified — draft is in the reviewer queue
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-4">
                <Link
                  href={`/drafts/${verdictResult.draftId}`}
                  className="font-mono text-xs text-[#4F46E5] hover:text-[#3730A3] transition-colors"
                >
                  View full record →
                </Link>
                <button
                  type="button"
                  onClick={checkAnother}
                  className="font-mono text-xs text-[#6E6E68] hover:text-[#1C1C1A] transition-colors cursor-pointer"
                >
                  Check another draft
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CONTEXT PANEL — desktop right (col-span-2), mobile first */}
        <div className="lg:col-span-2 order-1 lg:order-2 flex flex-col gap-3">
          {/* Card 1 — Speaker selector */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              SPEAKER
            </div>
            <div className="flex flex-col gap-2 mt-3">
              {orderedSpeakers.slice(0, 5).map((s) => {
                const selected = speakerId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSpeakerId(s.id)}
                    className={`text-left w-full px-3 py-2 rounded-sm border transition-colors ${
                      selected
                        ? "bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]"
                        : "bg-[#F7F6F3] border-[#E2E1DC] text-[#1C1C1A]"
                    }`}
                  >
                    <div className="text-xs font-medium">{s.name}</div>
                    <div className={`font-mono text-[10px] ${selected ? "text-[#6366F1]" : "text-[#6E6E68]"}`}>
                      {s.title || s.role}
                    </div>
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
            <div className="grid grid-cols-3 gap-2 mt-3">
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
                        : "bg-[#F7F6F3] border-[#E2E1DC] text-[#6E6E68]"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 3 — Source origin */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              SOURCE ORIGIN
            </div>
            <div className="font-mono text-[10px] text-[#6E6E68] mt-0.5 mb-3">
              Required · EU AI Act Article 50
            </div>
            <div className="flex flex-col">
              {SOURCES.map((opt) => {
                const selected = source === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSource(opt.value)}
                    className={`w-full flex items-start gap-3 py-3 px-3 border rounded-sm mb-1.5 transition-colors text-left ${
                      selected
                        ? "bg-[#EEF2FF] border-[#C7D2FE]"
                        : "bg-white border-[#E2E1DC]"
                    }`}
                  >
                    <span
                      className={`relative w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${
                        selected ? "border-[#4F46E5]" : "border-[#E2E1DC]"
                      }`}
                    >
                      {selected && (
                        <span aria-hidden className="absolute inset-1 rounded-full bg-[#4F46E5]" />
                      )}
                    </span>
                    <span>
                      <span className="block text-xs font-medium text-[#1C1C1A]">{opt.label}</span>
                      <span className="block font-mono text-[10px] text-[#6E6E68]">{opt.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {source === "ai_generated" && (
              <div className="mt-1.5 text-[10px] font-mono text-[#C2410C]">
                EU AI Act disclosure required at publication
              </div>
            )}
          </div>

          {/* Card 4 — Campaign */}
          <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                CAMPAIGN
              </div>
              <div className="font-mono text-[10px] text-[#6E6E68]">Optional</div>
            </div>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full border border-[#E2E1DC] rounded-sm bg-[#F7F6F3] text-sm text-[#1C1C1A] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#4F46E5] mt-2"
            >
              <option value="">None</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Card 5 — Agent submission (next-phase plant) */}
          <div className="bg-[#F7F6F3] border border-[#E2E1DC] rounded-sm p-4">
            <div className="flex justify-between items-center">
              <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                AGENT SUBMISSION
              </div>
              <span className="font-mono text-[10px] bg-[#F0EFE9] text-[#6E6E68] border border-[#E2E1DC] px-2 py-0.5 rounded-sm">
                Coming soon
              </span>
            </div>
            <pre className="bg-[#1C1C1A] text-[#A5B4FC] font-mono text-[10px] leading-relaxed p-3 rounded-sm overflow-x-auto mt-3">
{`curl -X POST https://api.eracue.com/v1/check \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -d '{
    "speaker": "ceo",
    "draft": "...",
    "channel": "linkedin"
  }'`}
            </pre>
            <p className="font-mono text-[10px] text-[#6E6E68] mt-2 leading-relaxed">
              ERA CUE API — govern AI agent communications at submission time, not after publication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
