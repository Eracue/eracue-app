"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { draftRuleAction, createRuleAction, type DraftedRule } from "./actions";

type Props = { isOpen: boolean; onClose: () => void };

type PanelState = "describe" | "review";

const VERDICT_STYLES: Record<DraftedRule["verdict"], { bg: string; text: string; border: string; label: string }> = {
  block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
};

const VERDICT_STRIPE: Record<DraftedRule["verdict"], string> = {
  block:    "bg-[#B91C1C]",
  escalate: "bg-[#C2410C]",
  review:   "bg-[#1D4ED8]",
  guide:    "bg-[#6D28D9]",
};

const EXAMPLE_CHIPS = [
  "Quiet period — no fundraising language",
  "Escalate all competitor mentions to reviewer",
  "Block forward guidance before earnings",
];

const PLACEHOLDER = `Describe what you want to govern in plain English.

Examples:
· No one should mention our Series B timeline before we announce
· Sales team needs legal review before claiming Fortune 500 wins
· CEO cannot discuss acquisition talks without legal sign-off
· No forward guidance language during earnings quiet period`;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddRulePanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [state, setState] = useState<PanelState>("describe");
  const [description, setDescription] = useState("");
  const [drafted, setDrafted] = useState<DraftedRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable review-state fields (populated from `drafted`)
  const [name, setName] = useState("");
  const [verdict, setVerdict] = useState<DraftedRule["verdict"]>("review");
  const [reviewDescription, setReviewDescription] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [activeFrom, setActiveFrom] = useState<string>(todayISO());
  const [activeUntil, setActiveUntil] = useState<string>("");

  // Reset all state when the panel closes so a fresh open starts at "describe".
  useEffect(() => {
    if (!isOpen) {
      setState("describe");
      setDescription("");
      setDrafted(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  function applyDrafted(d: DraftedRule) {
    setDrafted(d);
    setName(d.name);
    setVerdict(d.verdict);
    setReviewDescription(d.description);
    setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
    setActiveFrom(todayISO());
    setActiveUntil(d.suggested_end_date || "");
    setState("review");
  }

  async function handleDraft() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await draftRuleAction(description);
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      applyDrafted(result.drafted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft rule.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthorize() {
    if (!drafted) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createRuleAction({
        name,
        description: reviewDescription,
        verdict,
        keywords,
        scope: "all_speakers",
        effective_from: activeFrom
          ? new Date(activeFrom).toISOString()
          : new Date().toISOString(),
        effective_until: activeUntil ? new Date(activeUntil).toISOString() : null,
        regulatory_basis: drafted.regulatory_basis,
        authorized_by: "Sarah Chen, GC",
      });
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not authorize rule.");
      setLoading(false);
    }
  }

  function addKeyword() {
    const k = keywordInput.trim().replace(/,$/, "");
    if (!k || keywords.includes(k)) {
      setKeywordInput("");
      return;
    }
    setKeywords([...keywords, k]);
    setKeywordInput("");
  }
  function removeKeyword(k: string) {
    setKeywords(keywords.filter((x) => x !== k));
  }

  // Don't render the heavy panel content while closed — but keep mount stable
  // so transition fires smoothly when reopened. We toggle visibility via class.
  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* Slide-in panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-xl flex flex-col overflow-hidden transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E2E1DC] flex justify-between items-center">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              ADD GOVERNANCE RULE
            </div>
            <div
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-xl text-[#1C1C1A] mt-1"
            >
              {state === "describe" ? "Describe what you want to govern" : "Review and authorize"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#6E6E68] hover:text-[#1C1C1A] text-xl cursor-pointer leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {state === "describe" ? (
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={PLACEHOLDER}
                className="w-full min-h-[140px] border border-[#E2E1DC] rounded-sm p-4 text-sm text-[#1C1C1A] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              />
              <p className="text-xs font-mono text-[#6E6E68] mt-2 leading-relaxed">
                ERA CUE will draft the rule structure for your review. You can edit anything before authorizing.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                {EXAMPLE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setDescription(chip)}
                    className="text-xs font-mono bg-[#F0EFE9] text-[#6E6E68] border border-[#E2E1DC] px-3 py-1.5 rounded-sm hover:bg-[#E8E6DE] transition cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleDraft}
                disabled={loading || !description.trim()}
                className="bg-[#4F46E5] text-white text-sm font-medium w-full py-3 rounded-sm mt-6 hover:bg-[#4338CA] disabled:opacity-50 transition"
              >
                {loading ? "Drafting rule..." : "Draft this rule →"}
              </button>
              {error && (
                <div className="text-xs text-[#B91C1C] mt-2 font-mono">{error}</div>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setState("describe")}
                className="font-mono text-xs text-[#6E6E68] hover:text-[#1C1C1A] cursor-pointer mb-6 block"
              >
                ← Describe again
              </button>
              <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-sm px-4 py-3 text-xs font-mono text-[#3730A3] mb-6 leading-relaxed">
                ERA CUE drafted this rule — review and edit before authorizing.
              </div>

              {/* Rule name */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  RULE NAME
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              {/* Verdict */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  VERDICT
                </label>
                <div className="flex gap-2 mt-2">
                  {(Object.keys(VERDICT_STYLES) as DraftedRule["verdict"][]).map((v) => {
                    const s = VERDICT_STYLES[v];
                    const selected = verdict === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setVerdict(v)}
                        className={`text-xs font-mono px-3 py-1.5 rounded-sm cursor-pointer border ${
                          selected
                            ? `${s.bg} ${s.text} ${s.border}`
                            : "bg-[#F7F6F3] border-[#E2E1DC] text-[#6E6E68]"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  DESCRIPTION
                </label>
                <input
                  type="text"
                  value={reviewDescription}
                  onChange={(e) => setReviewDescription(e.target.value)}
                  className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              {/* Keywords */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  KEYWORDS
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {keywords.map((k) => (
                    <span
                      key={k}
                      className="bg-[#F0EFE9] text-[#6E6E68] font-mono text-xs px-2 py-1 rounded-sm border border-[#E2E1DC] flex items-center gap-1"
                    >
                      {k}
                      <button
                        type="button"
                        onClick={() => removeKeyword(k)}
                        className="text-[#9E9E96] hover:text-[#B91C1C] text-xs cursor-pointer"
                        aria-label={`Remove ${k}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.endsWith(",")) {
                      setKeywordInput(v.slice(0, -1));
                      addKeyword();
                    } else {
                      setKeywordInput(v);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Type a keyword and press Enter or comma"
                  className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              {/* Applies to */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  APPLIES TO
                </label>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    className="text-xs font-mono px-3 py-1.5 rounded-sm cursor-pointer border bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]"
                  >
                    All speakers
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Role-based scoping available in production")}
                    className="text-xs font-mono px-3 py-1.5 rounded-sm cursor-pointer border bg-[#F7F6F3] border-[#E2E1DC] text-[#9E9E96]"
                  >
                    By role
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Role-based scoping available in production")}
                    className="text-xs font-mono px-3 py-1.5 rounded-sm cursor-pointer border bg-[#F7F6F3] border-[#E2E1DC] text-[#9E9E96]"
                  >
                    Specific speaker
                  </button>
                </div>
              </div>

              {/* Active period */}
              <div className="mb-4">
                <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                  ACTIVE PERIOD
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="font-mono text-[10px] text-[#6E6E68] block mb-1">From</label>
                    <input
                      type="date"
                      value={activeFrom}
                      onChange={(e) => setActiveFrom(e.target.value)}
                      className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="font-mono text-[10px] text-[#6E6E68] block mb-1">Until</label>
                    <input
                      type="date"
                      value={activeUntil}
                      onChange={(e) => setActiveUntil(e.target.value)}
                      className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>
                </div>
              </div>

              {/* Regulatory basis (read-only) */}
              {drafted && (
                <div className="mb-4">
                  <label className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] block mb-2">
                    REGULATORY BASIS
                  </label>
                  <div className="text-sm text-[#1C1C1A]">{drafted.regulatory_basis}</div>
                  <div className="font-mono text-xs text-[#6E6E68] mt-1">
                    Set by ERA CUE based on rule type
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="border border-[#E2E1DC] rounded-sm p-4 bg-[#F7F6F3] mt-4">
                <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68] mb-2">
                  PREVIEW
                </div>
                <div className="bg-white border border-[#E2E1DC] rounded-sm flex overflow-hidden">
                  <div className={`w-1 shrink-0 ${VERDICT_STRIPE[verdict]}`} />
                  <div className="p-3 flex-1">
                    <div className="text-sm font-medium text-[#1C1C1A]">{name || "Rule name"}</div>
                    <div className="text-xs text-[#6E6E68] mt-1">{reviewDescription || "Description"}</div>
                    <div className="flex gap-1.5 mt-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border font-mono text-[10px] ${VERDICT_STYLES[verdict].bg} ${VERDICT_STYLES[verdict].text} ${VERDICT_STYLES[verdict].border}`}>
                        {VERDICT_STYLES[verdict].label}
                      </span>
                      <span className="bg-[#EEF2FF] text-[#3730A3] border border-[#C7D2FE] font-mono text-[10px] px-2 py-0.5 rounded-sm">
                        All speakers
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-xs text-[#B91C1C] mt-3 font-mono">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {state === "review" && (
          <div className="border-t border-[#E2E1DC] px-6 py-4 bg-white flex justify-between items-center">
            <div className="font-mono text-xs text-[#6E6E68]">
              Authorizing as: Sarah Chen · GC · Designated Principal
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="bg-white border border-[#E2E1DC] text-[#1C1C1A] text-sm px-4 py-2 rounded-sm hover:bg-[#F7F6F3] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={loading}
                className="bg-[#4F46E5] text-white text-sm font-medium px-5 py-2 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition"
              >
                {loading ? "Authorizing..." : "Authorize this rule →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
