"use client";

// v4 — two-phase Rule Builder.
//
//   Phase 1 (draft):  single-column input. Plain-language description,
//                     who-it-applies-to radio, optional expiry, and
//                     a "Draft this rule →" CTA that calls Claude.
//   Phase 2 (review): two-column structured preview. Left column shows
//                     what ERA CUE extracted from the description;
//                     right column lets the principal edit every
//                     field before authorizing. Two CTAs at the
//                     bottom — Authorize (rule_status = active) or
//                     Save draft only (rule_status = draft, lands in
//                     the Drafts tab).
//
// Replaces the v3 always-visible side-by-side panel; two phases is
// closer to how a CCO actually thinks about authoring a new rule.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  draftRuleAction,
  createRuleAction,
  type DraftedRule,
} from "./actions";
import {
  policyLabelFor,
  policyPlaceholderFor,
} from "./rules-client";

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
  // Drives the textarea placeholder + the policy-reference label
  // vocabulary on the Phase 2 form. Falls back to "default" copy
  // when the firm type is unknown.
  firmType?: string | null;
};

type AppliesTo = "all" | "role" | "person";
type BuilderPhase = "draft" | "review";

// Mutable mirror of DraftedRule — keeps the original immutable but
// lets the right-side panel edit every field. wsp_reference + channels
// + supplemental_note aren't on DraftedRule, so we layer them here.
type EditableDraft = {
  name: string;
  description: string;
  verdict: DraftedRule["verdict"];
  keywords: string[];
  channels: string[];
  regulatory_basis: string;
  wsp_reference: string;
  supplemental_note: string;
};

const APPLIES_OPTIONS: ReadonlyArray<{ key: AppliesTo; label: string }> = [
  { key: "all", label: "Everyone on my team" },
  { key: "role", label: "A specific role" },
  { key: "person", label: "One person" },
];

const VERDICT_OPTIONS: ReadonlyArray<{
  v: DraftedRule["verdict"];
  label: string;
  resting: string;
  active: string;
}> = [
  {
    v: "block",
    label: "Block",
    resting: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    active: "bg-[#B91C1C] text-white border-[#B91C1C]",
  },
  {
    v: "escalate",
    label: "Escalate",
    resting: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    active: "bg-[#B45309] text-white border-[#B45309]",
  },
  {
    v: "review",
    label: "Flag",
    resting: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D7FE]",
    active: "bg-[#4F46E5] text-white border-[#4F46E5]",
  },
  {
    v: "guide",
    label: "Guide",
    resting: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    active: "bg-[#166534] text-white border-[#166534]",
  },
];

// Firm-type-aware placeholder for the Phase 1 textarea. Reads as the
// principal's own vocabulary.
function placeholderFor(firmType: string | null | undefined): string {
  switch (firmType) {
    case "broker_dealer":
      return '"No registered person should post about client performance, guarantees, or returns on social media without prior principal review."';
    case "pr_agency":
      return '"No client communications should mention competitor pricing or make comparative claims without legal sign-off."';
    case "public_company":
      return '"No executive should post about earnings, guidance, or material company developments during our quiet period."';
    default:
      return '"No executive should mention hiring, fundraising, or growth projections during our active quiet window."';
  }
}

// Default channels we infer when the model's response doesn't
// include them. The principal can edit on the right-side panel.
const DEFAULT_CHANNELS = ["LinkedIn", "Twitter / X"];

export function AddRulePanel({ isOpen, onClose, firmType = null }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<BuilderPhase>("draft");
  const [plainText, setPlainText] = useState("");
  const [appliesTo, setAppliesTo] = useState<AppliesTo>("all");
  const [activeUntil, setActiveUntil] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftedRule, setDraftedRule] = useState<EditableDraft | null>(null);
  const [authorizing, setAuthorizing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function reset() {
    setPhase("draft");
    setPlainText("");
    setAppliesTo("all");
    setActiveUntil("");
    setDraftedRule(null);
    setError(null);
  }

  function getScopeValue(): string {
    if (appliesTo === "all") return "all_speakers";
    return appliesTo;
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
      // Promote the immutable DraftedRule into our EditableDraft +
      // backfill the fields that don't come back from the model.
      setDraftedRule({
        name: result.drafted.name,
        description: result.drafted.description,
        verdict: result.drafted.verdict,
        keywords: result.drafted.keywords,
        channels: DEFAULT_CHANNELS,
        regulatory_basis: result.drafted.regulatory_basis,
        wsp_reference: "",
        supplemental_note: "",
      });
      // Mirror the model's suggested expiry into the activeUntil
      // input only when the user hasn't already typed one.
      if (!activeUntil && result.drafted.suggested_end_date) {
        setActiveUntil(result.drafted.suggested_end_date);
      }
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
    } finally {
      setDrafting(false);
    }
  }

  async function persist(status: "active" | "draft") {
    if (!draftedRule) return;
    if (status === "active") setAuthorizing(true);
    else setSavingDraft(true);
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
        authorized_by: status === "active" ? "Principal" : "",
        wsp_reference: draftedRule.wsp_reference,
        rule_status: status,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setAuthorizing(false);
      setSavingDraft(false);
    }
  }

  function handleAuthorize() {
    void persist("active");
  }

  function handleSaveDraft() {
    void persist("draft");
  }

  // ─── PHASE 1 — single-column input ────────────────────────────
  if (phase === "draft") {
    return (
      <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-6 bg-white">
        <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-1">
              Rule builder
            </div>
            <h2
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-xl font-light text-[#0D1B2A] mb-1"
            >
              Describe what you want governed
            </h2>
            <p className="text-sm text-[#475569]">
              Plain language in. Structured, cited, enforceable rule
              out. You authorize before it fires.
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

        <div className="p-6">
          <label className="text-sm font-medium text-[#0D1B2A] block mb-2">
            Describe the rule
          </label>
          <textarea
            value={plainText}
            onChange={(e) => setPlainText(e.target.value)}
            placeholder={placeholderFor(firmType)}
            className="w-full min-h-[120px] border border-[#E2E8F0] rounded-sm p-4 text-sm text-[#0D1B2A] bg-[#F8FAFC] leading-relaxed italic focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none placeholder:text-[#94A3B8] placeholder:not-italic mb-4"
          />

          <div className="mb-4">
            <div className="text-sm font-medium text-[#0D1B2A] mb-3">
              Who does this apply to?
            </div>
            {APPLIES_OPTIONS.map((opt) => {
              const selected = appliesTo === opt.key;
              return (
                <label
                  key={opt.key}
                  className="flex items-center gap-3 mb-2.5 cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => setAppliesTo(opt.key)}
                    aria-pressed={selected}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
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

          <div className="mb-6">
            <label className="text-sm font-medium text-[#0D1B2A] block mb-2">
              Active until
              <span className="font-normal text-[#64748B] ml-1 text-xs">
                (optional — leave blank for no end date)
              </span>
            </label>
            <input
              type="date"
              value={activeUntil}
              onChange={(e) => setActiveUntil(e.target.value)}
              className="border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
            />
          </div>

          <button
            type="button"
            onClick={handleDraftRule}
            disabled={!plainText.trim() || drafting}
            className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {drafting ? (
              <>
                <Spinner />
                Drafting rule...
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
      </div>
    );
  }

  // ─── PHASE 2 — two-column review + edit ───────────────────────
  if (!draftedRule) return null;

  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-6 bg-white">
      <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#4F46E5] mb-1">
            ERA CUE drafted this rule
          </div>
          <div className="text-sm text-[#475569]">
            Review and authorize before it fires
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPhase("draft")}
          className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors cursor-pointer"
        >
          ← Edit description
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* LEFT — what ERA CUE extracted */}
        <div className="p-6 border-b md:border-b-0 md:border-r border-[#E2E8F0]">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#94A3B8] mb-4">
            Extracted from your description
          </div>

          <div className="space-y-3">
            <Field label="Your description">
              <div className="text-xs italic text-[#1E293B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm p-3 leading-relaxed">
                &ldquo;{plainText}&rdquo;
              </div>
            </Field>

            <Field label="Intent identified">
              <div className="text-xs text-[#1E293B] leading-relaxed">
                {draftedRule.description}
              </div>
            </Field>

            <Field label="Channels identified">
              <div className="flex gap-1 flex-wrap">
                {draftedRule.channels.map((ch) => (
                  <span
                    key={ch}
                    className="font-mono text-[9px] bg-[#EEF2FF] text-[#4338CA] border border-[#C7D7FE] px-2 py-0.5 rounded-sm"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </Field>

            {draftedRule.regulatory_basis && (
              <Field label="Regulatory anchor">
                <div className="font-mono text-[9px] text-[#4F46E5]">
                  {draftedRule.regulatory_basis}
                </div>
              </Field>
            )}
          </div>
        </div>

        {/* RIGHT — editable fields + authorize */}
        <div className="p-6">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#94A3B8] mb-4">
            Generated rule — all fields editable
          </div>

          <div className="space-y-3">
            <Field label="Rule name">
              <input
                type="text"
                value={draftedRule.name}
                onChange={(e) =>
                  setDraftedRule({ ...draftedRule, name: e.target.value })
                }
                className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              />
            </Field>

            <Field label="Type">
              <div className="flex gap-2 flex-wrap">
                {VERDICT_OPTIONS.map((opt) => {
                  const selected = draftedRule.verdict === opt.v;
                  return (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() =>
                        setDraftedRule({ ...draftedRule, verdict: opt.v })
                      }
                      className={`font-mono text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                        selected ? opt.active : opt.resting
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Keywords">
              <div className="flex flex-wrap gap-1 mb-1.5">
                {draftedRule.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="font-mono text-[9px] bg-[#F1F5F9] text-[#1E293B] border border-[#E2E8F0] px-2 py-0.5 rounded-sm"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add or edit keywords (comma-separated)"
                defaultValue={draftedRule.keywords.join(", ")}
                onChange={(e) =>
                  setDraftedRule({
                    ...draftedRule,
                    keywords: e.target.value
                      .split(",")
                      .map((k) => k.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-xs text-[#0D1B2A] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              />
            </Field>

            <Field label={policyLabelFor(firmType)}>
              <input
                type="text"
                value={draftedRule.wsp_reference}
                onChange={(e) =>
                  setDraftedRule({
                    ...draftedRule,
                    wsp_reference: e.target.value,
                  })
                }
                placeholder={policyPlaceholderFor(firmType)}
                className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-xs text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
              />
            </Field>

            {draftedRule.regulatory_basis && (
              <Field label="FINRA / regulatory basis">
                <div className="font-mono text-[9px] text-[#4F46E5]">
                  {draftedRule.regulatory_basis}
                </div>
              </Field>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={authorizing || savingDraft}
              className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {authorizing ? "Authorizing..." : "Authorize this rule →"}
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={authorizing || savingDraft}
              className="w-full bg-white text-[#475569] font-mono text-xs py-2.5 rounded-sm border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingDraft ? "Saving..." : "Save draft only"}
            </button>
          </div>

          <p className="font-mono text-[9px] text-[#94A3B8] text-center mt-3">
            Nothing goes live until you authorize.
          </p>

          {error && (
            <div
              className="font-mono text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-sm px-3 py-2 mt-3"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── shared bits ───────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-[0.11em] text-[#94A3B8] block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Spinner() {
  return (
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
  );
}
