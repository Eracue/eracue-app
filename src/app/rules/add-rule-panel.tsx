"use client";
// v2 — scope selector with role/person chips

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  draftRuleAction,
  createRuleAction,
  updateRuleAction,
  type DraftedRule,
} from "./actions";

// Structurally compatible with RuleRow from rules-client.tsx — declared here
// (instead of importing) to avoid a circular dependency. Extra fields on the
// caller's RuleRow are allowed by TS structural typing.
export type InitialRule = {
  id: string;
  name: string;
  description: string | null;
  verdict: string;
  keywords: string[] | null;
  scope: string | null;
  effective_from: string | null;
  effective_until: string | null;
  wsp_reference: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  initialRule?: InitialRule | null;
};

type PanelState = "describe" | "review" | "confirmed";
type ScopeType = "all" | "role" | "person";

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

const ROLES = ["CEO", "VP Comms", "VP Sales", "CMO", "General Counsel"];
const SPEAKERS = ["Marcus Rivera", "Lena Brooks", "James Kim", "Priya Patel", "Sarah Chen"];

// Reverse of getScopeValue() — turns a stored scope string back into the
// describe-state UI selection so an existing rule can be edited in place.
function parseScope(scope: string | null): {
  scopeType: ScopeType;
  scopeRole: string;
  scopePerson: string;
} {
  if (!scope || scope === "all_speakers") {
    return { scopeType: "all", scopeRole: "", scopePerson: "" };
  }
  if (scope.startsWith("role:")) {
    const slug = scope.slice("role:".length);
    const match = ROLES.find((r) => r.toLowerCase().replace(/\s+/g, "_") === slug);
    return { scopeType: "role", scopeRole: match ?? "", scopePerson: "" };
  }
  if (scope.startsWith("speaker:")) {
    const slug = scope.slice("speaker:".length);
    const match = SPEAKERS.find((s) => s.toLowerCase().replace(/\s+/g, "_") === slug);
    return { scopeType: "person", scopeRole: "", scopePerson: match ?? "" };
  }
  return { scopeType: "all", scopeRole: "", scopePerson: "" };
}

const PLACEHOLDER_ALL = `Describe what you want to govern in plain English.

Examples:
· No one should mention our Series B timeline before we announce
· Block any forward guidance language before earnings
· Escalate competitor comparisons to reviewer`;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddRulePanel({ isOpen, onClose, initialRule }: Props) {
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
  const [wspReference, setWspReference] = useState<string>("");

  // Scope state — driven from describe state, surfaces in review state.
  const [scopeType, setScopeType] = useState<ScopeType>("all");
  const [scopeRole, setScopeRole] = useState<string>("");
  const [scopePerson, setScopePerson] = useState<string>("");
  // Tracked for parity with spec; only the setter is read so eslint stays
  // happy without an explicit suppression.
  const [, setShowConfirmation] = useState(false);

  function getScopeLabel(): string {
    if (scopeType === "role" && scopeRole) return `${scopeRole} role`;
    if (scopeType === "person" && scopePerson) return scopePerson;
    return "All speakers";
  }

  function getScopeValue(): string {
    if (scopeType === "role" && scopeRole)
      return `role:${scopeRole.toLowerCase().replace(/\s+/g, "_")}`;
    if (scopeType === "person" && scopePerson)
      return `speaker:${scopePerson.toLowerCase().replace(/\s+/g, "_")}`;
    return "all_speakers";
  }

  // Reset all state when the panel closes; pre-fill from `initialRule` when
  // opening in edit mode.
  useEffect(() => {
    if (!isOpen) {
      setState("describe");
      setDescription("");
      setDrafted(null);
      setError(null);
      setLoading(false);
      setScopeType("all");
      setScopeRole("");
      setScopePerson("");
      setActiveUntil("");
      setWspReference("");
      setShowConfirmation(false);
      return;
    }
    if (initialRule) {
      const vRaw = initialRule.verdict;
      const v: DraftedRule["verdict"] =
        vRaw === "block" || vRaw === "escalate" || vRaw === "review" || vRaw === "guide"
          ? vRaw
          : "review";
      const desc = initialRule.description ?? initialRule.name;
      const kws = initialRule.keywords ?? [];
      const fromISO = initialRule.effective_from
        ? new Date(initialRule.effective_from).toISOString().slice(0, 10)
        : todayISO();
      const untilISO = initialRule.effective_until
        ? new Date(initialRule.effective_until).toISOString().slice(0, 10)
        : "";
      const synthDrafted: DraftedRule = {
        name: initialRule.name,
        description: desc,
        verdict: v,
        keywords: kws,
        scope: initialRule.scope ?? "all_speakers",
        suggested_end_date: untilISO || null,
        regulatory_basis: "FINRA Rule 2210(d) content standard",
      };
      const sp = parseScope(initialRule.scope);
      setDescription(desc);
      setDrafted(synthDrafted);
      setName(initialRule.name);
      setVerdict(v);
      setReviewDescription(desc);
      setKeywords(kws);
      setActiveFrom(fromISO);
      setActiveUntil(untilISO);
      setWspReference(initialRule.wsp_reference ?? "");
      setScopeType(sp.scopeType);
      setScopeRole(sp.scopeRole);
      setScopePerson(sp.scopePerson);
      setState("review");
      setError(null);
      setLoading(false);
    }
  }, [isOpen, initialRule]);

  function applyDrafted(d: DraftedRule) {
    setDrafted(d);
    setName(d.name);
    setVerdict(d.verdict);
    setReviewDescription(d.description);
    setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
    setActiveFrom(todayISO());
    // Preserve user-entered activeUntil over the suggested date.
    setActiveUntil((prev) => prev || d.suggested_end_date || "");
    setState("review");
  }

  async function handleDraft() {
    // Validate scope first so the user sees the error before the LLM call.
    if (scopeType === "role" && !scopeRole) {
      setError("Please select a role first.");
      return;
    }
    if (scopeType === "person" && !scopePerson) {
      setError("Please select a person first.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe the rule first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await draftRuleAction(description, {
        type: scopeType,
        label: getScopeLabel(),
      });
      if (!result.ok) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // If the user pre-set an end date in describe state, override the
      // suggested one before flipping to review state.
      const parsed: DraftedRule = activeUntil
        ? { ...result.drafted, suggested_end_date: activeUntil }
        : result.drafted;
      applyDrafted(parsed);
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
      const effectiveFromISO = activeFrom
        ? new Date(activeFrom).toISOString()
        : new Date().toISOString();
      const effectiveUntilISO = activeUntil
        ? new Date(activeUntil).toISOString()
        : null;

      const trimmedWsp = wspReference.trim();
      if (initialRule) {
        const result = await updateRuleAction({
          ruleId: initialRule.id,
          name,
          description: reviewDescription,
          verdict,
          keywords,
          scope: getScopeValue(),
          effective_from: effectiveFromISO,
          effective_until: effectiveUntilISO,
          wsp_reference: trimmedWsp,
        });
        if ("error" in result) {
          setError(result.error);
          setLoading(false);
          return;
        }
      } else {
        const result = await createRuleAction({
          name,
          description: reviewDescription,
          verdict,
          keywords,
          scope: getScopeValue(),
          effective_from: effectiveFromISO,
          effective_until: effectiveUntilISO,
          regulatory_basis: drafted.regulatory_basis,
          authorized_by: "Sarah Chen, GC",
          ...(trimmedWsp ? { wsp_reference: trimmedWsp } : {}),
        });
        if (!result.ok) {
          setError(result.error);
          setLoading(false);
          return;
        }
      }

      setState("confirmed");
      setShowConfirmation(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 2500);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : initialRule
            ? "Could not save changes."
            : "Could not authorize rule.",
      );
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

  // Scope-aware textarea placeholder.
  const placeholder =
    scopeType === "all"
      ? PLACEHOLDER_ALL
      : `Describe what this ${
          scopeType === "role" ? scopeRole || "role" : scopePerson || "person"
        } should or shouldn't say.

Examples:
· This ${scopeType === "role" ? "role" : "person"} needs legal review before claiming enterprise customer wins
· Block this ${scopeType === "role" ? "role" : "person"} from discussing acquisition talks without legal sign-off`;

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
        {/* Header — hidden on confirmation screen */}
        {state !== "confirmed" && (
          <div className="px-6 py-5 border-b border-[#E2E1DC] flex justify-between items-center">
            <div>
              <div className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
                {initialRule ? "EDIT GOVERNANCE RULE" : "ADD GOVERNANCE RULE"}
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
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {state === "describe" && (
            <>
              {/* Section A — scope */}
              <div className="mb-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-3">
                  Who does this apply to?
                </div>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "all" as const,    label: "Everyone on my team" },
                    { value: "role" as const,   label: "A specific role" },
                    { value: "person" as const, label: "One person" },
                  ]).map((opt) => {
                    const selected = scopeType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setScopeType(opt.value);
                          if (opt.value === "all") {
                            setScopeRole("");
                            setScopePerson("");
                          }
                        }}
                        className={`text-xs font-medium px-4 py-2 rounded-sm border transition-colors cursor-pointer ${
                          selected
                            ? "bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3]"
                            : "bg-[#F7F6F3] border-[#E2E1DC] text-[#6E6E68] hover:bg-[#F0EFE9]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                {scopeType === "role" && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ROLES.map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setScopeRole(role)}
                          className={`text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer font-mono ${
                            scopeRole === role
                              ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                              : "bg-white border-[#E2E1DC] text-[#1C1C1A] hover:bg-[#F7F6F3]"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    {!scopeRole && (
                      <div className="font-mono text-[10px] text-[#6E6E68] mt-2">Select a role above</div>
                    )}
                  </>
                )}

                {scopeType === "person" && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {SPEAKERS.map((speaker) => (
                        <button
                          key={speaker}
                          type="button"
                          onClick={() => setScopePerson(speaker)}
                          className={`text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer font-mono ${
                            scopePerson === speaker
                              ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                              : "bg-white border-[#E2E1DC] text-[#1C1C1A] hover:bg-[#F7F6F3]"
                          }`}
                        >
                          {speaker}
                        </button>
                      ))}
                    </div>
                    {!scopePerson && (
                      <div className="font-mono text-[10px] text-[#6E6E68] mt-2">Select a person above</div>
                    )}
                  </>
                )}
              </div>

              {/* Section B — describe */}
              <div className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-2">
                  Describe the rule
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={placeholder}
                  className="w-full min-h-[120px] border border-[#E2E1DC] rounded-sm p-4 text-sm text-[#1C1C1A] bg-white resize-none focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              {/* Section C — active until (optional) */}
              <div className="mb-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-2">
                  Active until
                  <span className="ml-2 normal-case not-italic text-[#9E9E96]">(optional)</span>
                </div>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  className="border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] font-mono"
                />
                <span className="font-mono text-[10px] text-[#9E9E96] ml-3">
                  Leave blank for no end date
                </span>
              </div>

              {/* Section D — helper copy */}
              <p className="text-xs font-mono text-[#6E6E68] mt-2 leading-relaxed">
                ERA CUE will draft the rule structure for your review. You can edit anything before authorizing.
              </p>

              {/* Section E — draft button */}
              <button
                type="button"
                onClick={handleDraft}
                disabled={loading}
                className="bg-[#4F46E5] text-white text-sm font-medium w-full py-3 rounded-sm mt-6 hover:bg-[#4338CA] disabled:opacity-50 transition"
              >
                {loading ? "Drafting rule..." : "Draft this rule →"}
              </button>
              {error && (
                <div className="text-xs text-[#B91C1C] mt-2 font-mono">{error}</div>
              )}
            </>
          )}

          {state === "review" && (
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

              {/* Applies to — read-only with "Change" link */}
              <div className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-2">
                  Applies to
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] font-mono text-xs px-3 py-1.5 rounded-sm">
                    {getScopeLabel()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setState("describe")}
                    className="font-mono text-[10px] text-[#6E6E68] hover:text-[#1C1C1A] transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
                {scopeType !== "all" && (
                  <p className="font-mono text-[10px] text-[#C2410C] mt-2 leading-relaxed">
                    Demo note: Scope is recorded on the rule. Org-wide enforcement applies in this demo — speaker-specific enforcement available in production.
                  </p>
                )}
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
                      value={drafted?.suggested_end_date || activeUntil || ""}
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

              {/* WSP reference — links rule to firm's Written Supervisory
                  Procedures section for FINRA examination purposes. */}
              <div className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#6E6E68] mb-1">
                  WSP REFERENCE
                </div>
                <div className="font-mono text-[10px] text-[#9E9E96] mb-2">
                  Optional · Written Supervisory Procedures section
                </div>
                <input
                  type="text"
                  value={wspReference}
                  onChange={(e) => setWspReference(e.target.value)}
                  placeholder="e.g. Section 4.2 — Social Media Communications"
                  className="w-full border border-[#E2E1DC] rounded-sm px-3 py-2 text-sm text-[#1C1C1A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
                <div className="font-mono text-[10px] text-[#9E9E96] mt-1">
                  Links this rule to your firm&apos;s Written Supervisory Procedures for FINRA examination purposes.
                </div>
              </div>

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
                        {getScopeLabel()}
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

          {state === "confirmed" && (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              {/* Green checkmark */}
              <div className="w-12 h-12 rounded-full bg-[#F0FDF4] border-2 border-[#BBF7D0] flex items-center justify-center mb-6">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#166534"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534] mb-3">
                Rule authorized and active
              </div>

              <div
                style={{ fontFamily: "var(--font-newsreader)" }}
                className="text-xl font-light text-[#1C1C1A] mb-2"
              >
                &ldquo;{drafted?.name}&rdquo;
              </div>

              <div className="text-sm text-[#6E6E68] mb-6 max-w-xs">
                Now governing {getScopeLabel()}. Authorized by Sarah Chen, GC.
              </div>

              <div className="font-mono text-[10px] text-[#9E9E96]">
                {new Date().toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>

              <div className="font-mono text-[10px] text-[#9E9E96] mt-6">
                Closing in a moment&hellip;
              </div>
            </div>
          )}
        </div>

        {/* Footer — only on review state */}
        {state === "review" && (
          <div className="border-t border-[#E2E1DC] px-6 py-4 bg-white flex justify-between items-center">
            <div>
              <div className="font-mono text-xs text-[#6E6E68]">
                Authorizing as: Sarah Chen · GC · Designated Principal
              </div>
              <div className="font-mono text-[10px] text-[#6E6E68] mt-1">
                Scope: {getScopeLabel()}
              </div>
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
                {loading
                  ? initialRule
                    ? "Saving..."
                    : "Authorizing..."
                  : initialRule
                    ? "Save changes →"
                    : "Authorize this rule →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
