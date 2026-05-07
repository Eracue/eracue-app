"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createRulesFromImport } from "../create-rules-action";
import type { CandidateRule } from "../templates";

// Verdict palette mirrors the rule-card / setup-view styling so a rule
// reads identically whether you see it in suggestions, on the confirm
// page, or after activation.
const VERDICT_BADGE: Record<
  CandidateRule["rule_type"],
  { className: string; label: string }
> = {
  block: {
    className: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
    label: "Will block",
  },
  escalate: {
    className: "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
    label: "Routes to review",
  },
  review: {
    className: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
    label: "Will flag",
  },
  guide: {
    className: "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]",
    label: "Show a reminder",
  },
};

const VERDICT_OPTIONS: ReadonlyArray<{
  value: CandidateRule["rule_type"];
  label: string;
}> = [
  { value: "block", label: "Block it" },
  { value: "escalate", label: "Route to review" },
  { value: "review", label: "Flag for review" },
  { value: "guide", label: "Show a reminder" },
];

export function ConfirmClient({
  initialRules,
}: {
  initialRules: CandidateRule[];
}) {
  const router = useRouter();
  // Pending rules — local state seeded from the URL-derived selection.
  // Edits and removals only affect this list; activation flushes the
  // whole list in one createRulesFromImport call.
  const [pendingRules, setPendingRules] =
    useState<CandidateRule[]>(initialRules);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePendingRule(index: number, updates: Partial<CandidateRule>) {
    setPendingRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...updates } : r)),
    );
  }

  function removePendingRule(index: number) {
    setPendingRules((prev) => prev.filter((_, i) => i !== index));
  }

  function appendPendingRule(rule: CandidateRule) {
    setPendingRules((prev) => [...prev, rule]);
    setShowQuickAdd(false);
  }

  async function handleActivate() {
    if (pendingRules.length === 0 || activating) return;
    setError(null);
    setActivating(true);
    try {
      const result = await createRulesFromImport(pendingRules);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/rules?activated=true");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-[720px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/rules"
            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors mb-6 inline-block"
          >
            ← Back to setup
          </a>
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
            Step 2 of 2 — Review and activate
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#0F172A] mb-3"
          >
            ERA CUE will enforce these rules.
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed">
            Review each rule before activating. You can edit keywords,
            change what the rule does, or remove rules you don&apos;t need.
            Changes take effect the moment you activate.
          </p>
        </div>

        {/* Inline error — covers activation failures + the rare edge
            where someone lands here with zero indices in the URL. */}
        {error && (
          <div
            className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs font-mono rounded-sm px-3 py-2 mb-4"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Empty state — happens when the URL ids list resolves to
            nothing. The user can still add rules from scratch via the
            quick-add panel below. */}
        {pendingRules.length === 0 && !showQuickAdd && (
          <div className="border border-[#E2E8F0] rounded-sm p-8 text-center bg-white mb-8">
            <div className="text-sm text-[#64748B] mb-3">
              No rules carried over from setup.
            </div>
            <a
              href="/rules"
              className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors"
            >
              ← Pick rules from setup
            </a>
          </div>
        )}

        {/* Pending rule cards */}
        {pendingRules.length > 0 && (
          <div className="space-y-4 mb-8">
            {pendingRules.map((rule, i) => (
              <ConfirmRuleCard
                key={i}
                rule={rule}
                onEdit={(updates) => updatePendingRule(i, updates)}
                onRemove={() => removePendingRule(i)}
              />
            ))}
          </div>
        )}

        {/* Add another */}
        {showQuickAdd ? (
          <QuickAddPanel
            onAdd={appendPendingRule}
            onCancel={() => setShowQuickAdd(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowQuickAdd(true)}
            className="w-full border border-dashed border-[#E2E8F0] rounded-sm p-4 text-sm text-[#64748B] hover:border-[#94A3B8] hover:text-[#0F172A] transition-colors mb-8 cursor-pointer"
          >
            + Add another rule
          </button>
        )}

        {/* Activate */}
        <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium text-[#0F172A] mb-1">
              Activate {pendingRules.length} rule
              {pendingRules.length !== 1 ? "s" : ""}
            </div>
            <div className="text-sm text-[#64748B]">
              ERA CUE will immediately begin checking every draft against
              these rules.
            </div>
          </div>
          <button
            type="button"
            onClick={handleActivate}
            disabled={activating || pendingRules.length === 0}
            className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-6 py-3 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 whitespace-nowrap transition-colors cursor-pointer"
          >
            {activating ? "Activating..." : "Activate governance →"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------- ConfirmRuleCard -----------------------------------------------

function ConfirmRuleCard({
  rule,
  onEdit,
  onRemove,
}: {
  rule: CandidateRule;
  onEdit: (updates: Partial<CandidateRule>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Same case-insensitive substring match the engine uses, so the
  // result the principal sees here matches what they'll get at /submit.
  function handleTest() {
    if (!testText.trim()) return;
    const lower = testText.toLowerCase();
    const matched = rule.keywords.some((kw) =>
      lower.includes(kw.toLowerCase()),
    );
    setTestResult(matched);
  }

  const badge = VERDICT_BADGE[rule.rule_type];

  return (
    <div className="border border-[#E2E8F0] rounded-sm overflow-hidden bg-white">
      <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Verdict + name */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span
              className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="text-sm font-semibold text-[#0F172A]">
              {rule.name}
            </span>
          </div>

          {/* Plain-English explanation */}
          <p className="text-sm text-[#374151] leading-relaxed mb-3">
            {rule.description}
          </p>

          {/* Keywords */}
          {rule.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {rule.keywords.slice(0, 6).map((kw) => (
                <span
                  key={kw}
                  className="font-mono text-[10px] bg-[#F1F5F9] text-[#374151] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                >
                  {kw}
                </span>
              ))}
              {rule.keywords.length > 6 && (
                <span className="font-mono text-[10px] text-[#94A3B8]">
                  +{rule.keywords.length - 6}
                </span>
              )}
            </div>
          )}

          {/* Regulatory basis + WSP reference */}
          {(rule.regulatory_basis || rule.wsp_reference) && (
            <div className="font-mono text-[9px] text-[#94A3B8]">
              {rule.regulatory_basis}
              {rule.regulatory_basis && rule.wsp_reference ? " · " : ""}
              {rule.wsp_reference}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB] transition-colors cursor-pointer"
          >
            {editing ? "Done" : "Edit"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="font-mono text-xs px-3 py-1.5 rounded-sm border border-[#E2E8F0] text-[#94A3B8] hover:border-[#FCA5A5] hover:text-[#B91C1C] transition-colors cursor-pointer"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Inline edit panel */}
      {editing && (
        <div className="border-t border-[#E2E8F0] bg-[#F8F9FB] px-5 py-4 space-y-4">
          {/* Rule name */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
              Rule name
            </label>
            <input
              type="text"
              defaultValue={rule.name}
              onChange={(e) => onEdit({ name: e.target.value })}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            />
          </div>

          {/* Action selector — plain-English labels above the verdict
              palette. Wraps so the four chips don't overflow on narrow
              viewports. */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
              What ERA CUE will do
            </label>
            <div className="flex gap-2 flex-wrap">
              {VERDICT_OPTIONS.map((opt) => {
                const selected = rule.rule_type === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onEdit({ rule_type: opt.value })}
                    className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#0F172A] border-[#0F172A] text-white"
                        : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
              Keywords that trigger this rule
              <span className="normal-case ml-1 font-normal text-[#94A3B8]">
                (comma-separated)
              </span>
            </label>
            <input
              type="text"
              defaultValue={rule.keywords.join(", ")}
              onChange={(e) =>
                onEdit({
                  keywords: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean),
                })
              }
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white font-mono focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            />
          </div>

          {/* Test the rule */}
          <div className="bg-white border border-[#E2E8F0] rounded-sm p-4">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
              Test this rule
            </div>
            <div className="text-xs text-[#64748B] mb-3">
              Paste a sentence to see if this rule would fire on it.
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={testText}
                onChange={(e) => {
                  setTestText(e.target.value);
                  setTestResult(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleTest();
                  }
                }}
                placeholder="Type a sentence to test..."
                className="flex-1 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={!testText.trim()}
                className="font-mono text-xs bg-[#0F172A] text-white px-4 py-2 rounded-sm hover:bg-[#1E293B] disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
              >
                Test →
              </button>
            </div>
            {testResult !== null && (
              <div
                className={`font-mono text-[10px] mt-2 flex items-center gap-1.5 ${
                  testResult ? "text-[#B91C1C]" : "text-[#166534]"
                }`}
              >
                {testResult
                  ? "✗ Would trigger this rule"
                  : "✓ Would not trigger this rule"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- QuickAddPanel -------------------------------------------------

// Minimal in-page form for tacking on a custom rule without leaving the
// confirm flow. Keeps the four CandidateRule fields the activation
// action actually needs (name, rule_type, description, keywords) and
// fills wsp_reference / regulatory_basis with empty strings — those
// citations come from the regulatory-basis catalog when the user
// authors a rule via the import panel later.
function QuickAddPanel({
  onAdd,
  onCancel,
}: {
  onAdd: (rule: CandidateRule) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [ruleType, setRuleType] =
    useState<CandidateRule["rule_type"]>("block");
  const [description, setDescription] = useState("");
  const [keywordsStr, setKeywordsStr] = useState("");

  const canAdd = name.trim().length > 0 && description.trim().length > 0;

  function handleAdd() {
    if (!canAdd) return;
    onAdd({
      name: name.trim(),
      rule_type: ruleType,
      description: description.trim(),
      keywords: keywordsStr
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      wsp_reference: "",
      regulatory_basis: "",
      source: "manual",
    });
  }

  return (
    <div className="border border-[#E2E8F0] rounded-sm p-5 bg-white mb-8 space-y-4">
      <div className="text-sm font-medium text-[#0F172A]">Add a custom rule</div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          Rule name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. No competitor mentions"
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          What ERA CUE will do
        </label>
        <div className="flex gap-2 flex-wrap">
          {VERDICT_OPTIONS.map((opt) => {
            const selected = ruleType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRuleType(opt.value)}
                className={`font-mono text-xs px-3 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                  selected
                    ? "bg-[#0F172A] border-[#0F172A] text-white"
                    : "bg-white border-[#E2E8F0] text-[#64748B] hover:bg-[#F8F9FB]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          What does this rule check for?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One sentence — what should ERA CUE catch?"
          rows={2}
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8] resize-none"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5">
          Keywords that trigger this rule
          <span className="normal-case ml-1 font-normal text-[#94A3B8]">
            (comma-separated, optional)
          </span>
        </label>
        <input
          type="text"
          value={keywordsStr}
          onChange={(e) => setKeywordsStr(e.target.value)}
          placeholder="competitor name 1, competitor name 2"
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-white font-mono focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="bg-[#0F172A] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1E293B] disabled:opacity-40 transition-colors cursor-pointer"
        >
          Add to list
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
