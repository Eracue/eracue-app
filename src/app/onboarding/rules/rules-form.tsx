"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizeOnboardingRulesAction, type SuggestedRuleInput } from "../actions";
import { extractRulesFromWsp, type SuggestedRule as ExtractedRule } from "@/app/rules/wsp-import-action";

type Mode = "suggested" | "wsp";

const VERDICT_BADGE: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  block: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  review: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide: { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
};

function RuleCard({
  rule,
  selected,
  onToggle,
}: {
  rule: SuggestedRuleInput | ExtractedRule;
  selected: boolean;
  onToggle: () => void;
}) {
  const badge = VERDICT_BADGE[rule.rule_type] ?? VERDICT_BADGE.review;
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-4 mb-2 flex items-start gap-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 w-4 h-4 accent-[#1A56DB] cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${badge.bg} ${badge.text} ${badge.border}`}
          >
            {badge.label}
          </span>
          <span className="text-sm font-semibold text-[#0F172A]">{rule.name}</span>
        </div>
        <div className="text-sm text-[#374151] mb-1">{rule.description}</div>
        <div className="font-mono text-[10px] text-[#94A3B8]">
          {rule.wsp_reference}
          {rule.wsp_reference && rule.regulatory_basis ? " · " : ""}
          {rule.regulatory_basis}
        </div>
        {rule.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {rule.keywords.map((kw) => (
              <span
                key={kw}
                className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function RulesForm({ suggested }: { suggested: SuggestedRuleInput[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("suggested");

  // Suggested-track state — preselect everything; user opts out.
  const [suggestedPicks, setSuggestedPicks] = useState<Set<number>>(
    new Set(suggested.map((_, i) => i)),
  );

  // WSP-track state.
  const [wspText, setWspText] = useState("");
  const [extracted, setExtracted] = useState<ExtractedRule[]>([]);
  const [extractedPicks, setExtractedPicks] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState("");

  function toggleSet(set: Set<number>, idx: number, setSet: (s: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSet(next);
  }

  async function handleExtract() {
    if (!wspText.trim() || importing) return;
    setImporting(true);
    setError("");
    setExtracted([]);
    setExtractedPicks(new Set());
    const result = await extractRulesFromWsp(wspText);
    if (!result.ok) {
      setError(result.error);
    } else {
      setExtracted(result.suggested_rules);
      setExtractedPicks(new Set(result.suggested_rules.map((_, i) => i)));
    }
    setImporting(false);
  }

  async function handleAuthorize() {
    setError("");
    const picks =
      mode === "suggested"
        ? suggested.filter((_, i) => suggestedPicks.has(i))
        : extracted.filter((_, i) => extractedPicks.has(i));
    if (picks.length === 0) {
      setError("Select at least one rule, or skip this step.");
      return;
    }
    setAuthorizing(true);
    const result = await authorizeOnboardingRulesAction(picks);
    if (!result.ok) {
      setError(result.error);
      setAuthorizing(false);
      return;
    }
    router.push("/onboarding/speakers");
    router.refresh();
  }

  async function handleSkip() {
    // Skipping rules is allowed but not encouraged. Authorize an empty
    // set just to mark the step done — the action refuses zero, so we
    // jump straight to the next step instead.
    router.push("/onboarding/speakers");
    router.refresh();
  }

  const selectedCount =
    mode === "suggested" ? suggestedPicks.size : extractedPicks.size;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
      {/* Mode toggle */}
      <div className="flex bg-[#F1F5F9] rounded-sm p-1 gap-1 mb-5 w-fit">
        {(
          [
            { value: "suggested" as const, label: "Use suggested rules" },
            { value: "wsp" as const, label: "Import from WSP" },
          ]
        ).map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`font-mono text-xs px-3 py-1 rounded-sm transition-colors ${
              mode === m.value
                ? "bg-white text-[#0F172A] shadow-sm"
                : "text-[#64748B] hover:text-[#0F172A]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-sm px-3 py-2 mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      {mode === "suggested" ? (
        <>
          <div className="text-sm text-[#374151] mb-4 leading-relaxed">
            We&apos;ve picked starter rules based on your firm type. Review,
            uncheck anything that doesn&apos;t fit, and authorize. You can edit
            or add more rules from the rules page after onboarding.
          </div>
          {suggested.map((rule, i) => (
            <RuleCard
              key={rule.name}
              rule={rule}
              selected={suggestedPicks.has(i)}
              onToggle={() =>
                toggleSet(suggestedPicks, i, (s) => setSuggestedPicks(s))
              }
            />
          ))}
        </>
      ) : (
        <>
          <div className="text-sm text-[#374151] mb-3 leading-relaxed">
            Paste a section of your Written Supervisory Procedures.
            ERA CUE will extract candidate rules — review and authorize the
            ones that fit.
          </div>
          <textarea
            value={wspText}
            onChange={(e) => setWspText(e.target.value)}
            placeholder="Paste your WSP section here..."
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-3 text-sm text-[#0F172A] bg-[#F8F9FB] h-32 focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8] resize-none mb-3"
          />
          <button
            type="button"
            onClick={handleExtract}
            disabled={!wspText.trim() || importing}
            className="bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors mb-4"
          >
            {importing ? "Analyzing WSP..." : "Extract rules from WSP →"}
          </button>

          {extracted.length > 0 && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mb-2">
                Suggested rules · {extracted.length} found
              </div>
              {extracted.map((rule, i) => (
                <RuleCard
                  key={`${rule.name}-${i}`}
                  rule={rule}
                  selected={extractedPicks.has(i)}
                  onToggle={() =>
                    toggleSet(extractedPicks, i, (s) => setExtractedPicks(s))
                  }
                />
              ))}
            </>
          )}
        </>
      )}

      <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={handleSkip}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={handleAuthorize}
          disabled={authorizing || selectedCount === 0}
          className="bg-[#0F172A] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
        >
          {authorizing
            ? "Authorizing..."
            : `Authorize ${selectedCount} rule${selectedCount !== 1 ? "s" : ""} →`}
        </button>
      </div>
    </div>
  );
}
