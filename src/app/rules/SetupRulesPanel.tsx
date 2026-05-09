"use client";

// Three-path Add Rules panel. Replaces the old single-purpose Rule
// Builder with a starting screen that lets the visitor pick how
// they want to author governance:
//
//   1. Import        → paste / upload an existing policy
//   2. Templates     → firm-type starter pack
//   3. Describe      → plain-language input → AI-extracted rule(s)
//
// All three paths converge on the same Candidate Review screen,
// then the same Authorization Success state. The two outer flows
// (processing + success) are state-driven and override the path
// rendering when active.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { draftRuleAction } from "./actions";
import { extractRulesFromWsp } from "./wsp-import-action";
import {
  createRulesFromImport,
  type CandidateRuleInput,
} from "./create-rules-action";
import { TEMPLATES } from "./templates";
import { policyLabelFor, policyPlaceholderFor } from "./rules-client";

// ---------- Types --------------------------------------------------

type Props = {
  isOpen: boolean;
  onClose: () => void;
  firmType?: string | null;
};

type PanelPath = null | "import" | "templates" | "describe";
type ImportMethod = "paste" | "upload";
type ProcessingState =
  | "idle"
  | "processing"
  | "ready"
  | "authorizing"
  | "success";

type Verdict = "block" | "escalate" | "review" | "guide";

type RuleCandidate = {
  id: string;
  name: string;
  description: string;
  rule_type: Verdict;
  keywords: string[];
  regulatory_basis: string;
  wsp_reference: string;
  source_section?: string;
  applies_to: string;
  effective_to: string | null;
  selected: boolean;
  expanded: boolean;
};

// ---------- Visual constants --------------------------------------

const VERDICT_STYLES: Record<
  Verdict,
  { badge: string; resting: string; active: string }
> = {
  block: {
    badge: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    resting: "bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]",
    active: "bg-[#B91C1C] text-white border-[#B91C1C]",
  },
  escalate: {
    badge: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    resting: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
    active: "bg-[#B45309] text-white border-[#B45309]",
  },
  review: {
    badge: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D7FE]",
    resting: "bg-[#EEF2FF] text-[#4338CA] border-[#C7D7FE]",
    active: "bg-[#4F46E5] text-white border-[#4F46E5]",
  },
  guide: {
    badge: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    resting: "bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]",
    active: "bg-[#166534] text-white border-[#166534]",
  },
};

const VERDICT_LABELS: Record<Verdict, string> = {
  block: "BLOCK",
  escalate: "ESCALATE",
  review: "FLAG",
  guide: "GUIDE",
};

const FIRM_TYPE_PILLS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "broker_dealer", label: "Broker-dealer" },
  { key: "ria", label: "RIA" },
  { key: "public_company", label: "Public company" },
  { key: "pr_agency", label: "PR agency" },
  { key: "executive_team", label: "Executive team" },
  { key: "investment_bank", label: "IB / PE / HF" },
];

const APPLIES_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "all", label: "Everyone on my team" },
  { key: "role", label: "A specific role" },
  { key: "person", label: "One person" },
];

// Path-specific placeholder vocabulary. Reads as the visitor's
// own context.
function describePlaceholderFor(firmType: string | null | undefined): string {
  switch (firmType) {
    case "broker_dealer":
      return '"No registered person should post about client performance or returns. All influencer content needs principal review before it goes live. Block anything comparing us to competitors."';
    case "pr_agency":
      return '"No client post should make comparative claims without legal sign-off. Flag pricing comparisons. Block posts during client quiet periods."';
    case "public_company":
      return '"Block executive posts about earnings or guidance during our quiet period. Flag hiring announcements before the press release. Escalate anything about M&A."';
    default:
      return '"Flag mentions of fundraising amounts. Block posts about headcount or revenue during our quiet window. Escalate any pricing comparisons."';
  }
}

function pastePlaceholderFor(firmType: string | null | undefined): string {
  if (firmType === "broker_dealer") {
    return "§4.3 Social Media Supervision\n\n(a) All registered persons must obtain prior written approval from a registered principal before posting content related to the firm's business on any social media platform.\n\n(b) Posts containing performance claims, testimonials, or client references require GC review...";
  }
  return "Paste your policy, WSP section, or governance document here...";
}

// ---------- Component ---------------------------------------------

export function SetupRulesPanel({ isOpen, onClose, firmType = null }: Props) {
  const router = useRouter();
  const [path, setPath] = useState<PanelPath>(null);
  const [importMethod, setImportMethod] = useState<ImportMethod>("paste");
  const [processing, setProcessing] = useState<ProcessingState>("idle");
  const [candidates, setCandidates] = useState<RuleCandidate[]>([]);
  const [authorizedCount, setAuthorizedCount] = useState(0);
  const [description, setDescription] = useState("");
  const [appliesTo, setAppliesTo] = useState("all");
  const [activeUntil, setActiveUntil] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedFirmType, setSelectedFirmType] = useState<string>(
    firmType === "rIA" ? "ria" : firmType ?? "broker_dealer",
  );
  const [selectedTemplates, setSelectedTemplates] = useState<Set<number>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function fullReset() {
    setPath(null);
    setImportMethod("paste");
    setProcessing("idle");
    setCandidates([]);
    setAuthorizedCount(0);
    setDescription("");
    setAppliesTo("all");
    setActiveUntil("");
    setPastedText("");
    setUploadedFile(null);
    setSelectedTemplates(new Set());
    setError(null);
  }

  function buildCandidate(
    raw: {
      name: string;
      description: string;
      rule_type: Verdict;
      keywords: string[];
      regulatory_basis: string;
      wsp_reference: string;
    },
    index: number,
    sourceSection?: string,
  ): RuleCandidate {
    return {
      id: `candidate-${index}`,
      name: raw.name,
      description: raw.description,
      rule_type: raw.rule_type,
      keywords: raw.keywords,
      regulatory_basis: raw.regulatory_basis,
      wsp_reference: raw.wsp_reference ?? "",
      source_section: sourceSection,
      applies_to: appliesTo,
      effective_to: activeUntil
        ? new Date(activeUntil).toISOString()
        : null,
      selected: true,
      expanded: false,
    };
  }

  // ── Handlers — describe ─────────────────────────────────────────
  async function handleDescribe() {
    if (!description.trim()) return;
    setError(null);
    setProcessing("processing");
    try {
      const result = await draftRuleAction(description);
      if (!result.ok) {
        setError(result.error);
        setProcessing("idle");
        return;
      }
      // DraftedRule uses `verdict`; the candidate shape uses
      // `rule_type`. The drafting action also doesn't return a
      // wsp_reference, so it's left blank for the user to fill
      // on the candidate-edit panel.
      setCandidates([
        buildCandidate(
          {
            name: result.drafted.name,
            description: result.drafted.description,
            rule_type: result.drafted.verdict,
            keywords: result.drafted.keywords,
            regulatory_basis: result.drafted.regulatory_basis,
            wsp_reference: "",
          },
          0,
        ),
      ]);
      setProcessing("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
      setProcessing("idle");
    }
  }

  // ── Handlers — import (paste) ───────────────────────────────────
  async function handleImportPaste() {
    if (!pastedText.trim()) return;
    setError(null);
    setProcessing("processing");
    try {
      const result = await extractRulesFromWsp(pastedText, false);
      if (!result.ok) {
        setError(result.error);
        setProcessing("idle");
        return;
      }
      setCandidates(
        result.suggested_rules.map((r, i) =>
          buildCandidate(r, i, r.wsp_reference),
        ),
      );
      setProcessing("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
      setProcessing("idle");
    }
  }

  // ── Handlers — import (upload) ─────────────────────────────────
  async function handleImportUpload() {
    if (!uploadedFile) return;
    setError(null);
    setProcessing("processing");
    try {
      // Best-effort plain-text read. Binary PDF/Word arrive as
      // garbled bytes that the model can still extract from in
      // most cases; a future enhancement would route binary
      // uploads through a server-side parser first.
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) ?? "");
        reader.onerror = () =>
          reject(reader.error ?? new Error("File read failed"));
        reader.readAsText(uploadedFile);
      });
      const result = await extractRulesFromWsp(text, false);
      if (!result.ok) {
        setError(result.error);
        setProcessing("idle");
        return;
      }
      setCandidates(
        result.suggested_rules.map((r, i) =>
          buildCandidate(r, i, r.wsp_reference),
        ),
      );
      setProcessing("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload parsing failed.");
      setProcessing("idle");
    }
  }

  // ── Handler — templates ────────────────────────────────────────
  function handleTemplateReview() {
    const bucket = TEMPLATES[selectedFirmType] ?? [];
    const picked = Array.from(selectedTemplates)
      .sort((a, b) => a - b)
      .map((i, position) => {
        const tpl = bucket[i];
        if (!tpl) return null;
        return buildCandidate(
          {
            name: tpl.name,
            description: tpl.description,
            rule_type: tpl.rule_type,
            keywords: tpl.keywords,
            regulatory_basis: tpl.regulatory_basis,
            wsp_reference: tpl.wsp_reference,
          },
          position,
        );
      })
      .filter((c): c is RuleCandidate => Boolean(c));
    if (picked.length === 0) return;
    setCandidates(picked);
    setProcessing("ready");
  }

  // ── Authorize / Save Drafts ───────────────────────────────────
  async function persist(status: "active" | "draft") {
    const selected = candidates.filter((c) => c.selected);
    if (selected.length === 0) return;
    setError(null);
    setProcessing("authorizing");
    try {
      const payload: CandidateRuleInput[] = selected.map((c) => ({
        name: c.name,
        rule_type: c.rule_type,
        description: c.description,
        keywords: c.keywords,
        wsp_reference: c.wsp_reference,
        regulatory_basis: c.regulatory_basis,
        source: path ?? "manual",
        rule_status: status,
        effective_to: c.effective_to,
      }));
      const result = await createRulesFromImport(payload);
      if (!result.ok) {
        setError(result.error);
        setProcessing("ready");
        return;
      }
      router.refresh();
      if (status === "active") {
        setAuthorizedCount(selected.length);
        setProcessing("success");
      } else {
        fullReset();
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      setProcessing("ready");
    }
  }

  function handleAuthorize() {
    void persist("active");
  }
  function handleSaveDrafts() {
    void persist("draft");
  }

  // ── Candidate-row local mutations ─────────────────────────────
  function toggleSelected(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    );
  }
  function toggleExpanded(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c)),
    );
  }
  function patchCandidate(id: string, patch: Partial<RuleCandidate>) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  // ─── SCREEN 5 — success ───────────────────────────────────────
  if (processing === "success") {
    return (
      <Frame>
        <div className="bg-[#F0FDF4] border-b border-[#BBF7D0] px-6 py-5 flex items-start gap-4">
          <div className="text-2xl text-[#0EA5E9] shrink-0 mt-0.5" aria-hidden>
            ✓
          </div>
          <div>
            <div className="text-base font-semibold text-[#0D1B2A] mb-1">
              {authorizedCount} rule{authorizedCount !== 1 ? "s" : ""}{" "}
              authorized and active.
            </div>
            <div className="text-sm text-[#475569]">
              ERA CUE will now check every draft against{" "}
              {authorizedCount === 1 ? "this rule" : "these rules"} before
              publication.
            </div>
          </div>
        </div>

        <div className="px-6 py-5 bg-white">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-4">
            Authorization record — created now
          </div>

          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-sm px-4 py-3 flex items-start gap-3 mb-5">
            <span className="text-base shrink-0 mt-0.5" aria-hidden>
              🔒
            </span>
            <div>
              <div className="font-mono text-[9px] font-bold text-[#0D1B2A] mb-1 uppercase tracking-[0.1em]">
                Authorization locked
              </div>
              <div className="font-mono text-[9px] text-[#64748B] leading-relaxed">
                {authorizedCount === 1 ? "This" : "Each"} authorization
                record is SHA-256 hashed and append-only. The principal
                identity, timestamp, and rule parameters cannot be altered.
                This is the supervisory evidence ERA CUE creates.
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <a
              href="/check"
              className="bg-[#4F46E5] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#4338CA] transition-colors"
            >
              Check your first draft →
            </a>
            <button
              type="button"
              onClick={() => fullReset()}
              className="font-mono text-xs text-[#64748B] px-3 py-2.5 border border-[#E2E8F0] rounded-sm hover:bg-[#F8FAFC] transition-colors cursor-pointer"
            >
              Add more rules
            </button>
            <button
              type="button"
              onClick={() => {
                fullReset();
                onClose();
              }}
              className="font-mono text-xs text-[#94A3B8] px-3 py-2.5 hover:text-[#0D1B2A] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  // ─── SCREEN 4 — candidate review ──────────────────────────────
  if (processing === "ready" || processing === "authorizing") {
    const selectedCount = candidates.filter((c) => c.selected).length;
    return (
      <Frame>
        <BackNav
          label="Discard and choose a different method"
          onClick={() => {
            setProcessing("idle");
            setCandidates([]);
          }}
        />
        <div className="px-6 pb-6 pt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-2">
            Candidate review
          </div>
          <h2
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-xl font-light text-[#0D1B2A] mb-1 leading-tight"
          >
            Review what ERA CUE produced
          </h2>
          <p className="text-sm text-[#475569] mb-5">
            Uncheck any rule you don&apos;t want. Click Edit on a card to
            adjust the name, verdict, or keywords. Nothing goes live until
            you authorize.
          </p>

          <div className="space-y-3 mb-5">
            {candidates.map((c) => {
              const styles = VERDICT_STYLES[c.rule_type];
              return (
                <div
                  key={c.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    c.selected
                      ? "border-[#4F46E5] bg-[#EEF2FF]"
                      : "border-[#E2E8F0] bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelected(c.id)}
                      aria-pressed={c.selected}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        c.selected
                          ? "bg-[#4F46E5] border-[#4F46E5]"
                          : "border-[#CBD5E1] bg-white"
                      }`}
                    >
                      {c.selected && (
                        <svg
                          className="w-3 h-3 text-white"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm border ${styles.badge}`}
                        >
                          {VERDICT_LABELS[c.rule_type]}
                        </span>
                        <span className="text-sm font-medium text-[#0D1B2A]">
                          {c.name}
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed mb-2">
                        {c.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.keywords.slice(0, 6).map((kw) => (
                          <span
                            key={kw}
                            className="font-mono text-[9px] bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                          >
                            {kw}
                          </span>
                        ))}
                        {c.keywords.length > 6 && (
                          <span className="font-mono text-[9px] text-[#94A3B8]">
                            +{c.keywords.length - 6} more
                          </span>
                        )}
                      </div>
                      {c.regulatory_basis && (
                        <div className="font-mono text-[9px] text-[#4F46E5]">
                          {c.regulatory_basis}
                        </div>
                      )}
                      {c.source_section && (
                        <div className="font-mono text-[9px] text-[#94A3B8] mt-1">
                          Source: {c.source_section}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(c.id)}
                      className="font-mono text-[10px] text-[#64748B] hover:text-[#0D1B2A] transition-colors shrink-0 cursor-pointer"
                    >
                      {c.expanded ? "Done" : "Edit"}
                    </button>
                  </div>

                  {c.expanded && (
                    <div className="mt-4 pt-4 border-t border-[#C7D7FE] space-y-3">
                      <Field label="Rule name">
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) =>
                            patchCandidate(c.id, { name: e.target.value })
                          }
                          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </Field>
                      <Field label="Verdict type">
                        <div className="flex gap-2 flex-wrap">
                          {(
                            [
                              "block",
                              "escalate",
                              "review",
                              "guide",
                            ] as const
                          ).map((v) => {
                            const sel = c.rule_type === v;
                            return (
                              <button
                                key={v}
                                type="button"
                                onClick={() =>
                                  patchCandidate(c.id, { rule_type: v })
                                }
                                className={`font-mono text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-sm border transition-colors cursor-pointer ${
                                  sel
                                    ? VERDICT_STYLES[v].active
                                    : VERDICT_STYLES[v].resting
                                }`}
                              >
                                {VERDICT_LABELS[v]}
                              </button>
                            );
                          })}
                        </div>
                      </Field>
                      <Field label="Description">
                        <textarea
                          value={c.description}
                          onChange={(e) =>
                            patchCandidate(c.id, {
                              description: e.target.value,
                            })
                          }
                          rows={2}
                          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none"
                        />
                      </Field>
                      <Field label="Keywords (comma-separated)">
                        <input
                          type="text"
                          defaultValue={c.keywords.join(", ")}
                          onChange={(e) =>
                            patchCandidate(c.id, {
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
                          value={c.wsp_reference}
                          onChange={(e) =>
                            patchCandidate(c.id, {
                              wsp_reference: e.target.value,
                            })
                          }
                          placeholder={policyPlaceholderFor(firmType)}
                          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-xs text-[#0D1B2A] bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={selectedCount === 0 || processing === "authorizing"}
              className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors cursor-pointer"
            >
              {processing === "authorizing"
                ? "Authorizing..."
                : selectedCount === 0
                  ? "Select rules to continue"
                  : `Authorize ${selectedCount} rule${selectedCount !== 1 ? "s" : ""} →`}
            </button>
            <button
              type="button"
              onClick={handleSaveDrafts}
              disabled={selectedCount === 0 || processing === "authorizing"}
              className="w-full bg-white text-[#475569] font-mono text-xs py-2.5 rounded-sm border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-50 transition-colors cursor-pointer"
            >
              Save as drafts
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
      </Frame>
    );
  }

  // ─── SCREEN 3 — processing ────────────────────────────────────
  if (processing === "processing") {
    const labels =
      path === "import"
        ? [
            "Reading policy text...",
            "Identifying enforceable rules...",
            "Extracting source sections...",
            "Matching regulatory basis...",
          ]
        : path === "describe"
          ? [
              "Reading your description...",
              "Identifying governance intents...",
              "Extracting keywords...",
              "Matching regulatory basis...",
            ]
          : ["Loading templates..."];
    const heading =
      path === "import"
        ? "Extracting rules from your policy..."
        : path === "describe"
          ? "Parsing your description..."
          : "Loading templates...";
    return (
      <Frame>
        <div className="p-10 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-8">
            {heading}
          </div>
          <div className="flex flex-col gap-4 max-w-[260px] mx-auto text-left">
            {labels.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse flex-shrink-0"
                  aria-hidden
                />
                <span className="font-mono text-[11px] text-[#0D1B2A]">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Frame>
    );
  }

  // ─── SCREEN 1 — starting screen ───────────────────────────────
  if (path === null) {
    return (
      <Frame>
        <div className="p-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B] mb-2">
              Add governance rules
            </div>
            <h2
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="text-xl font-light text-[#0D1B2A] leading-tight"
            >
              How do you want to set up your rules?
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              fullReset();
              onClose();
            }}
            aria-label="Close"
            className="font-mono text-xs text-[#94A3B8] hover:text-[#0D1B2A] transition-colors cursor-pointer"
          >
            × Close
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          <PathOption
            title="I already have a policy"
            description={`Paste or upload your existing ${policyLabelFor(firmType).toLowerCase()}, social media policy, or communications handbook. ERA CUE extracts every enforceable rule with source citations.`}
            footer="📄 Paste text · 📎 Upload PDF or Word"
            onClick={() => setPath("import")}
          />
          <PathOption
            title="Start from templates"
            description="Pre-built rules for your firm type — already cited to the specific regulation they enforce. Select the ones that apply and authorize in one step."
            footer="Broker-dealer · RIA · Public company · PR agency · IB / PE"
            onClick={() => setPath("templates")}
          />
          <PathOption
            title="Describe what I need to govern"
            description="Plain language in. Structured, cited, enforceable rule out. Describe one situation or several — ERA CUE parses multiple intents into separate rules automatically."
            footer="One rule or several · ERA CUE extracts all intents"
            onClick={() => setPath("describe")}
          />
        </div>
      </Frame>
    );
  }

  // ─── SCREEN 2A — import ───────────────────────────────────────
  if (path === "import") {
    return (
      <Frame>
        <BackNav
          label="Choose a different method"
          onClick={() => setPath(null)}
        />
        <div className="px-6 pb-6 pt-3">
          <div className="flex gap-2 mb-5">
            {(
              [
                { key: "paste" as const, label: "📄 Paste text" },
                { key: "upload" as const, label: "📎 Upload file" },
              ]
            ).map((opt) => {
              const sel = importMethod === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setImportMethod(opt.key)}
                  className={`font-mono text-xs px-4 py-2 rounded-sm border transition-colors cursor-pointer ${
                    sel
                      ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                      : "bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {importMethod === "paste" ? (
            <>
              <label className="text-sm font-medium text-[#0D1B2A] block mb-1">
                Paste your policy text
              </label>
              <div className="font-mono text-[9px] text-[#94A3B8] mb-3">
                ERA CUE extracts every enforceable rule and cites the source
                section. Works with WSPs, social media policies, comms
                handbooks, or any governance document.
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                placeholder={pastePlaceholderFor(firmType)}
                className="w-full border border-[#E2E8F0] rounded-sm p-4 text-sm text-[#0D1B2A] bg-[#F8FAFC] leading-relaxed font-mono focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none placeholder:font-sans placeholder:not-italic placeholder:text-[#94A3B8] mb-4"
              />
              <button
                type="button"
                onClick={handleImportPaste}
                disabled={!pastedText.trim()}
                className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors cursor-pointer"
              >
                Extract rules from text →
              </button>
            </>
          ) : (
            <>
              <label className="text-sm font-medium text-[#0D1B2A] block mb-1">
                Upload a policy document
              </label>
              <div className="font-mono text-[9px] text-[#94A3B8] mb-4">
                ERA CUE parses the full document and extracts every
                enforceable rule with section references.
              </div>
              {!uploadedFile ? (
                <label className="block border-2 border-dashed border-[#E2E8F0] rounded-lg p-10 text-center cursor-pointer hover:border-[#4F46E5] transition-colors">
                  <div className="text-3xl mb-3" aria-hidden>
                    ↑
                  </div>
                  <div className="text-sm font-medium text-[#0D1B2A] mb-1">
                    Drop a file or click to upload
                  </div>
                  <div className="font-mono text-[9px] text-[#94A3B8]">
                    PDF · Word (.docx) · Plain text
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setUploadedFile(f);
                    }}
                  />
                </label>
              ) : (
                <div>
                  <div className="border border-[#E2E8F0] rounded-lg p-4 flex items-center justify-between mb-4 bg-white">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        📄
                      </span>
                      <div>
                        <div className="text-sm font-medium text-[#0D1B2A]">
                          {uploadedFile.name}
                        </div>
                        <div className="font-mono text-[9px] text-[#94A3B8]">
                          {(uploadedFile.size / 1024).toFixed(0)}KB · Ready
                          to parse
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFile(null)}
                      className="font-mono text-xs text-[#94A3B8] hover:text-[#B91C1C] transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportUpload}
                    className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] transition-colors cursor-pointer"
                  >
                    Parse and extract rules →
                  </button>
                </div>
              )}
            </>
          )}

          {error && (
            <div
              className="font-mono text-xs text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-sm px-3 py-2 mt-3"
              role="alert"
            >
              {error}
            </div>
          )}
        </div>
      </Frame>
    );
  }

  // ─── SCREEN 2B — templates ─────────────────────────────────────
  if (path === "templates") {
    const bucket = TEMPLATES[selectedFirmType] ?? [];
    return (
      <Frame>
        <BackNav
          label="Choose a different method"
          onClick={() => setPath(null)}
        />
        <div className="px-6 pb-6 pt-3">
          <div className="text-sm font-medium text-[#0D1B2A] mb-3">
            My organization is a
          </div>

          <div className="flex gap-2 flex-wrap mb-6">
            {FIRM_TYPE_PILLS.map((ft) => {
              const sel = selectedFirmType === ft.key;
              return (
                <button
                  key={ft.key}
                  type="button"
                  onClick={() => {
                    setSelectedFirmType(ft.key);
                    setSelectedTemplates(new Set());
                  }}
                  className={`text-sm px-4 py-2 rounded-sm border transition-colors cursor-pointer ${
                    sel
                      ? "bg-[#0D1B2A] border-[#0D1B2A] text-white"
                      : "bg-white border-[#E2E8F0] text-[#374151] hover:border-[#94A3B8]"
                  }`}
                >
                  {ft.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 mb-5">
            {bucket.length === 0 ? (
              <div className="text-sm text-[#94A3B8] font-mono text-center py-8">
                No starter templates for this firm type yet. Try the
                describe path or import an existing policy.
              </div>
            ) : (
              bucket.map((rule, i) => {
                const sel = selectedTemplates.has(i);
                const styles = VERDICT_STYLES[rule.rule_type as Verdict];
                return (
                  <div
                    key={`${rule.name}-${i}`}
                    onClick={() => {
                      const next = new Set(selectedTemplates);
                      if (next.has(i)) next.delete(i);
                      else next.add(i);
                      setSelectedTemplates(next);
                    }}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      sel
                        ? "border-[#4F46E5] bg-[#EEF2FF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#94A3B8]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          sel
                            ? "bg-[#4F46E5] border-[#4F46E5]"
                            : "border-[#CBD5E1] bg-white"
                        }`}
                        aria-hidden
                      >
                        {sel && (
                          <svg
                            className="w-3 h-3 text-white"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 6l3 3 5-5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`font-mono text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm border ${styles.badge}`}
                          >
                            {VERDICT_LABELS[rule.rule_type as Verdict]}
                          </span>
                          <span className="text-sm font-medium text-[#0D1B2A]">
                            {rule.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#475569] leading-relaxed mb-1.5">
                          {rule.description}
                        </p>
                        <div className="font-mono text-[9px] text-[#4F46E5]">
                          {rule.regulatory_basis}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={handleTemplateReview}
            disabled={selectedTemplates.size === 0}
            className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors cursor-pointer"
          >
            {selectedTemplates.size === 0
              ? "Select rules to continue"
              : `Review ${selectedTemplates.size} selected rule${selectedTemplates.size !== 1 ? "s" : ""} →`}
          </button>
        </div>
      </Frame>
    );
  }

  // ─── SCREEN 2C — describe ─────────────────────────────────────
  return (
    <Frame>
      <BackNav
        label="Choose a different method"
        onClick={() => setPath(null)}
      />
      <div className="px-6 pb-6 pt-3">
        <label className="text-sm font-medium text-[#0D1B2A] block mb-1">
          Describe what you want to govern
        </label>
        <div className="font-mono text-[9px] text-[#94A3B8] mb-3">
          Describe one situation or several. ERA CUE parses multiple intents
          into separate rules automatically.
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder={describePlaceholderFor(firmType)}
          className="w-full border border-[#E2E8F0] rounded-sm p-4 text-sm text-[#0D1B2A] bg-[#F8FAFC] leading-relaxed italic focus:outline-none focus:ring-1 focus:ring-[#4F46E5] resize-none placeholder:not-italic placeholder:text-[#94A3B8] mb-4"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <div className="text-sm font-medium text-[#0D1B2A] mb-2">
              Who does this apply to?
            </div>
            {APPLIES_OPTIONS.map((opt) => {
              const sel = appliesTo === opt.key;
              return (
                <label
                  key={opt.key}
                  className="flex items-center gap-2.5 mb-2 cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => setAppliesTo(opt.key)}
                    aria-pressed={sel}
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      sel
                        ? "border-[#4F46E5] bg-[#4F46E5]"
                        : "border-[#CBD5E1] bg-white"
                    }`}
                  >
                    {sel && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-white"
                        aria-hidden
                      />
                    )}
                  </button>
                  <span className="text-xs text-[#1E293B]">{opt.label}</span>
                </label>
              );
            })}
          </div>
          <div>
            <label className="text-sm font-medium text-[#0D1B2A] block mb-2">
              Active until
              <span className="font-normal text-[#64748B] ml-1 text-xs">
                (optional)
              </span>
            </label>
            <input
              type="date"
              value={activeUntil}
              onChange={(e) => setActiveUntil(e.target.value)}
              className="border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0D1B2A] font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] w-full"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDescribe}
          disabled={!description.trim()}
          className="w-full bg-[#4F46E5] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#4338CA] disabled:opacity-40 transition-colors cursor-pointer"
        >
          Extract rules →
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
    </Frame>
  );
}

// ─── shared bits ────────────────────────────────────────────────

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-[#E2E8F0] rounded-lg overflow-hidden mb-6 bg-white">
      {children}
    </div>
  );
}

function BackNav({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="px-6 pt-4 pb-0">
      <button
        type="button"
        onClick={onClick}
        className="font-mono text-xs text-[#64748B] hover:text-[#0D1B2A] transition-colors flex items-center gap-1.5 cursor-pointer"
      >
        <span>←</span>
        <span>{label}</span>
      </button>
    </div>
  );
}

function PathOption({
  title,
  description,
  footer,
  onClick,
}: {
  title: string;
  description: string;
  footer: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-[#E2E8F0] rounded-lg p-5 bg-white hover:border-[#4F46E5] hover:bg-[#EEF2FF] transition-colors group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[#0D1B2A] mb-1 group-hover:text-[#4F46E5]">
            {title}
          </div>
          <div className="text-xs text-[#64748B] leading-relaxed">
            {description}
          </div>
        </div>
        <span
          className="text-[#94A3B8] group-hover:text-[#4F46E5] font-mono text-lg shrink-0 mt-0.5"
          aria-hidden
        >
          →
        </span>
      </div>
      <div className="font-mono text-[9px] text-[#94A3B8] mt-3 flex items-center gap-3 flex-wrap">
        {footer}
      </div>
    </button>
  );
}

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
