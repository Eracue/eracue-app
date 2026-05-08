"use client";

// v3 — Rule Builder. Two-panel inline form. Left half = plain-language
// description + applies-to selector + optional expiry; right half =
// ERA CUE's structured draft, editable in place, with an Authorize
// button that flushes through createRuleAction. Replaces the
// previous side-drawer state machine.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  draftRuleAction,
  createRuleAction,
  type DraftedRule,
} from "./actions";

// Kept on the API for backward compatibility with rules-client.tsx —
// the prop is unused now (inline edit-rule lives below each rule
// card) but keeping the type makes the Props change a no-op for the
// caller.
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

type AppliesTo = "all" | "role" | "person";

const VERDICT_TEXT_COLOR: Record<DraftedRule["verdict"], string> = {
  block: "text-[#B91C1C]",
  escalate: "text-[#F59E0B]",
  review: "text-[#4F46E5]",
  guide: "text-[#475569]",
};

const VERDICT_LABEL: Record<DraftedRule["verdict"], string> = {
  block: "BLOCK",
  escalate: "ESCALATE",
  review: "REVIEW",
  guide: "GUIDE",
};

const APPLIES_OPTIONS: ReadonlyArray<{ key: AppliesTo; label: string }> = [
  { key: "all", label: "Everyone on my team" },
  { key: "role", label: "A specific role" },
  { key: "person", label: "One person" },
];

const PLACEHOLDER = `"No executive should mention pricing, discounts, or competitive comparisons on LinkedIn or X without prior review from legal — especially during our active fundraising period."`;

export function AddRulePanel({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [plainText, setPlainText] = useState("");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("all");
  const [activeUntil, setActiveUntil] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftedRule, setDraftedRule] = useState<DraftedRule | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function reset() {
    setPlainText("");
    setAppliesTo("all");
    setActiveUntil("");
    setDraftReady(false);
    setDraftedRule(null);
    setError(null);
  }

  async function handleDraftRule() {
    if (!plainText.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const result = await draftRuleAction(plainText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // If the model returned a suggested end date and the user hasn't
      // typed one, copy it across so the right-side preview is live.
      if (!activeUntil && result.drafted.suggested_end_date) {
        setActiveUntil(result.drafted.suggested_end_date);
      }
      setDraftedRule(result.drafted);
      setDraftReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
    } finally {
      setDrafting(false);
    }
  }

  function getScopeValue(): string {
    if (appliesTo === "all") return "all_speakers";
    return appliesTo;
  }

  async function handleAuthorize() {
    if (!draftedRule) return;
    setAuthorizing(true);
    setError(null);
    try {
      const result = await createRuleAction({
        name: draftedRule.name,
        description: draftedRule.description,
        verdict: draftedRule.verdict,
        keywords: draftedRule.keywords,
        scope: getScopeValue(),
        effective_from: new Date().toISOString(),
        effective_until: activeUntil
          ? new Date(activeUntil).toISOString()
          : null,
        regulatory_basis: draftedRule.regulatory_basis,
        authorized_by: "Principal",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authorization failed.");
    } finally {
      setAuthorizing(false);
    }
  }

  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-6 bg-white">
      {/* Panel header */}
      <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-xl font-light text-[#0D1B2A] mb-1"
          >
            Rule Builder — Describe what you want governed
          </h2>
          <p className="text-sm text-[#475569]">
            Plain language in. Structured, FINRA-cited, enforceable rule
            out. Principal authorizes before it fires.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            onClose();
          }}
          aria-label="Close"
          className="font-mono text-xs text-[#94A3B8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
        >
          × Close
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* LEFT — plain language input */}
        <div className="p-6 border-b md:border-b-0 md:border-r border-[#E2E8F0]">
          <label className="text-sm font-medium text-[#0D1B2A] block mb-3">
            Describe the rule
          </label>

          <textarea
            value={plainText}
            onChange={(e) => {
              setPlainText(e.target.value);
              setDraftReady(false);
            }}
            placeholder={PLACEHOLDER}
            className="w-full min-h-[140px] border border-[#E2E8F0] rounded-sm p-4 text-sm text-[#0D1B2A] italic bg-[#F8FAFC] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none placeholder:text-[#94A3B8] placeholder:not-italic mb-4"
          />

          {/* Applies to */}
          <div className="mb-4">
            <div className="text-sm font-medium text-[#0D1B2A] mb-3">
              Who does this apply to?
            </div>
            {APPLIES_OPTIONS.map((opt) => {
              const selected = appliesTo === opt.key;
              return (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 mb-2 cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => setAppliesTo(opt.key)}
                    aria-pressed={selected}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                      selected
                        ? "border-[#4F46E5] bg-[#4F46E5]"
                        : "border-[#CBD5E1] bg-white"
                    }`}
                  >
                    {selected && (
                      <span
                        className="w-2 h-2 rounded-full bg-white"
                        aria-hidden
                      />
                    )}
                  </button>
                  <span className="text-sm text-[#1E293B]">{opt.label}</span>
                </label>
              );
            })}
          </div>

          {/* Active until */}
          <div className="mb-6">
            <label className="text-sm font-medium text-[#0D1B2A] block mb-2">
              Active until
              <span className="font-normal text-[#64748B] ml-1">
                (optional)
              </span>
            </label>
            <input
              type="date"
              value={activeUntil}
              onChange={(e) => setActiveUntil(e.target.value)}
              className="border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            />
          </div>

          {/* Draft button */}
          <button
            type="button"
            onClick={handleDraftRule}
            disabled={!plainText.trim() || drafting}
            className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {drafting ? (
              <>
                <svg
                  className="animate-spin h-3 w-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Drafting...
              </>
            ) : (
              "Draft this rule →"
            )}
          </button>

          {error && (
            <div
              className="font-mono text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-sm px-3 py-2 mt-3"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>

        {/* RIGHT — ERA CUE structured output */}
        <div
          className={`p-6 transition-opacity ${
            draftReady ? "opacity-100" : "opacity-40"
          }`}
        >
          {!draftReady || !draftedRule ? (
            <div className="flex items-center justify-center h-full text-sm text-[#94A3B8] font-mono text-center leading-relaxed">
              ERA CUE will draft the rule structure for your review. You
              can edit anything before authorizing.
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-[#4F46E5] mb-1">
                ERA CUE drafted this rule
              </div>
              <div className="text-xs text-[#64748B] mb-5">
                Review and authorize before it fires
              </div>

              {(
                [
                  { label: "Rule name", value: draftedRule.name },
                  {
                    label: "Type",
                    value: VERDICT_LABEL[draftedRule.verdict],
                    color: VERDICT_TEXT_COLOR[draftedRule.verdict],
                    bold: true,
                  },
                  {
                    label: "Applies to",
                    value:
                      appliesTo === "all"
                        ? "All speakers"
                        : appliesTo === "role"
                          ? "Specific role"
                          : "One person",
                  },
                  {
                    label: "Channels",
                    value: "LinkedIn · Twitter / X",
                  },
                  {
                    label: "Keywords",
                    value: draftedRule.keywords.join(" · "),
                  },
                  {
                    label: "Active until",
                    value: activeUntil
                      ? new Date(activeUntil).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No end date",
                  },
                  {
                    label: "FINRA basis",
                    value: draftedRule.regulatory_basis,
                  },
                ] as const
              ).map((field) => (
                <div
                  key={field.label}
                  className="flex items-start py-2.5 border-b border-[#E2E8F0] last:border-0"
                >
                  <span className="text-xs text-[#64748B] w-28 shrink-0">
                    {field.label}
                  </span>
                  <span
                    className={`text-xs flex-1 ${
                      "color" in field && field.color
                        ? `font-bold ${field.color}`
                        : "font-medium text-[#0D1B2A]"
                    }`}
                  >
                    {field.value}
                  </span>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAuthorize}
                disabled={authorizing}
                className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors mt-5 flex items-center justify-center gap-2 cursor-pointer"
              >
                {authorizing ? "Authorizing..." : "Authorize this rule →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
