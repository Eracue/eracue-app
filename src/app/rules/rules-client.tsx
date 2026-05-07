"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddRulePanel } from "./add-rule-panel";
import { deactivateRuleAction } from "./actions";
import {
  extractRulesFromWsp,
  authorizeSuggestedRulesAction,
  type SuggestedRule,
} from "./wsp-import-action";

export type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  verdict: string; // aliased from rule_type in the parent select
  keywords: string[] | null;
  effective_from: string | null;
  effective_until: string | null; // aliased from effective_to
  scope: string | null;
  rule_status: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  wsp_reference: string | null;
  trigger_count?: number;
  last_triggered?: string | null;
};

type Tab = "all" | "active" | "expired" | "deactivated";

const VERDICT_STRIPE: Record<string, string> = {
  block:    "bg-[#B91C1C]",
  escalate: "bg-[#C2410C]",
  review:   "bg-[#1D4ED8]",
  guide:    "bg-[#6D28D9]",
};

const VERDICT_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  block:    { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK" },
  escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE" },
  review:   { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW" },
  guide:    { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function scopeLabel(scope: string | null): string {
  if (!scope || scope === "all_speakers") return "All speakers";
  return scope;
}

// Derived classification — distinguishes "expired" (date past) from "deactivated"
// (manually shut off) and "active" (effective and not deactivated).
function classifyRule(r: RuleRow, now: number): "active" | "expired" | "deactivated" {
  if (r.rule_status === "deactivated") return "deactivated";
  const fromTime = r.effective_from ? new Date(r.effective_from).getTime() : 0;
  const toTime = r.effective_until ? new Date(r.effective_until).getTime() : null;
  if (toTime !== null && now > toTime) return "expired";
  if (now < fromTime) return "active"; // future-dated rules show as active for the demo
  return "active";
}

function buildFooterText(r: RuleRow, classification: "active" | "expired" | "deactivated"): string {
  let prefix: string;
  if (classification === "deactivated") {
    prefix = `Deactivated ${fmtDate(r.deactivated_at)}`;
  } else if (classification === "expired") {
    prefix = `Expired ${fmtDate(r.effective_until)}`;
  } else if (r.effective_until) {
    prefix = `Active until ${fmtDate(r.effective_until)}`;
  } else {
    prefix = "Active — no end date";
  }
  return `${prefix} · Authorized by Sarah Chen, GC · Applies to: ${scopeLabel(r.scope)} · Rule 2210(d)`;
}

type Props = { rules: RuleRow[]; corpusCount?: number };

export function RulesClient({ rules, corpusCount = 0 }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [pending, startTransition] = useTransition();

  // WSP import state. The panel toggles open from the header; once
  // suggested rules come back the user picks which to authorize via the
  // checkbox set, then the action inserts the curated subset in one shot.
  const [wspOpen, setWspOpen] = useState(false);
  const [wspText, setWspText] = useState("");
  const [importing, setImporting] = useState(false);
  const [wspError, setWspError] = useState<string | null>(null);
  const [suggestedRules, setSuggestedRules] = useState<SuggestedRule[]>([]);
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [authorizing, setAuthorizing] = useState(false);

  async function handleWspImport() {
    if (!wspText.trim() || importing) return;
    setImporting(true);
    setWspError(null);
    setSuggestedRules([]);
    setSelectedRules(new Set());
    try {
      const result = await extractRulesFromWsp(wspText);
      if (!result.ok) {
        setWspError(result.error);
        return;
      }
      setSuggestedRules(result.suggested_rules);
      // Default: every extracted rule selected — the user opts out of any
      // they don't want rather than opting in.
      setSelectedRules(new Set(result.suggested_rules.map((_, i) => i)));
    } catch (e) {
      setWspError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function handleAuthorizeSelected() {
    if (selectedRules.size === 0 || authorizing) return;
    const picks = suggestedRules.filter((_, i) => selectedRules.has(i));
    setAuthorizing(true);
    setWspError(null);
    try {
      const result = await authorizeSuggestedRulesAction(picks);
      if (!result.ok) {
        setWspError(result.error);
        return;
      }
      // Reset and close the panel; refresh so the new rules appear.
      setWspText("");
      setSuggestedRules([]);
      setSelectedRules(new Set());
      setWspOpen(false);
      router.refresh();
    } catch (e) {
      setWspError(e instanceof Error ? e.message : "Authorization failed.");
    } finally {
      setAuthorizing(false);
    }
  }

  const now = Date.now();
  const classified = useMemo(() => {
    return rules.map((r) => ({ rule: r, classification: classifyRule(r, now) }));
  }, [rules, now]);

  const counts = useMemo(() => {
    let active = 0, expired = 0, deactivated = 0, firing = 0, silent = 0;
    for (const { rule, classification } of classified) {
      if (classification === "active") active++;
      else if (classification === "expired") expired++;
      else deactivated++;
      const triggers = rule.trigger_count ?? 0;
      if (triggers > 0) firing++;
      else if (classification === "active") silent++;
    }
    return { total: rules.length, active, expired, deactivated, firing, silent };
  }, [classified, rules.length]);

  const filtered = useMemo(() => {
    if (tab === "all") return classified;
    return classified.filter((c) => c.classification === tab);
  }, [classified, tab]);

  function handleDeactivate(id: string) {
    const reason = window.prompt("Why are you deactivating this rule?");
    if (!reason || !reason.trim()) return;
    startTransition(async () => {
      const result = await deactivateRuleAction({ ruleId: id, reason: reason.trim() });
      if (!result.ok) {
        alert("Could not deactivate: " + result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-[#F8F9FB]">
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        {/* Header row */}
        <div className="flex justify-between items-start gap-6">
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-[#64748B]">
              GOVERNANCE RULES · AUTHORIZED BY SARAH CHEN, GC
            </div>
            <h1
              style={{ fontFamily: "var(--font-newsreader)" }}
              className="font-light text-3xl text-[#0F172A] mt-2"
            >
              Your rules govern every speaker, every draft.
            </h1>
            <p className="text-sm text-[#64748B] max-w-xl mt-2 leading-relaxed">
              One principal. Every speaker on your team checks against these
              policies before anything goes live. Add a rule and it takes
              effect immediately.
            </p>

            {/* WSP framing — positions ERA CUE as the enforcement layer of
                an existing supervisory framework rather than a replacement.
                Lives between the subtitle and the stats strip so it reads
                as the lens through which the page is meant to be read. */}
            <div className="mt-4 bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm px-5 py-4 flex items-start gap-4 max-w-2xl">
              <div className="shrink-0 mt-0.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1A56DB"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#0F172A] mb-1">
                  ERA CUE enforces your Written Supervisory Procedures.
                </div>
                <div className="text-sm text-[#374151] leading-relaxed">
                  Each rule references the WSP section it implements. ERA CUE
                  becomes the enforcement layer of your existing supervisory
                  framework — not a replacement for it.
                </div>
                <div className="font-mono text-xs text-[#1A56DB] mt-2">
                  Add a WSP reference when creating or editing any rule →
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="bg-[#1A56DB] text-white text-sm font-semibold px-5 py-2.5 rounded-sm hover:bg-[#1447C0] transition"
            >
              Add a rule
            </button>
            <button
              type="button"
              onClick={() => setWspOpen((o) => !o)}
              className="bg-white border border-[#E2E8F0] text-[#0F172A] text-sm px-4 py-2 rounded-sm hover:bg-[#F8F9FB] transition cursor-pointer"
            >
              Import from WSP
            </button>
          </div>
        </div>

        {/* WSP import panel — collapsible. Lives between the header and
            the stats strip so the extraction UI sits in front of the rule
            cards while it's open. */}
        {wspOpen && (
          <div className="bg-[#EFF8FF] border border-[#BAE6FD] rounded-sm p-5 mb-6 mt-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mb-2">
              Import rules from your WSPs
            </div>

            <div className="text-sm text-[#374151] mb-4 leading-relaxed">
              Paste your Written Supervisory Procedures section on communications supervision.
              ERA CUE will suggest rules based on your existing compliance procedures.
            </div>

            <textarea
              value={wspText}
              onChange={(e) => setWspText(e.target.value)}
              placeholder={`Paste your WSP section here...

Example: 'All associated persons must submit social media posts for principal review 24 hours before publication. Posts containing performance claims, testimonials, or forward-looking statements require CCO approval...'`}
              className="w-full border border-[#BAE6FD] rounded-sm px-3 py-3 text-sm text-[#0F172A] bg-white h-32 focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8] resize-none"
            />

            <button
              type="button"
              onClick={handleWspImport}
              disabled={!wspText.trim() || importing}
              className="mt-3 bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {importing ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Analyzing WSP...
                </>
              ) : (
                "Extract rules from WSP →"
              )}
            </button>

            {wspError && (
              <div className="font-mono text-xs text-[#B91C1C] mt-3">{wspError}</div>
            )}

            {suggestedRules.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[#BAE6FD]">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mb-3">
                  Suggested rules · {suggestedRules.length} found
                </div>
                {suggestedRules.map((rule, i) => (
                  <div
                    key={`${rule.name}-${i}`}
                    className="bg-white border border-[#E2E8F0] rounded-sm p-4 mb-2 flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRules.has(i)}
                      onChange={(e) => {
                        const next = new Set(selectedRules);
                        if (e.target.checked) next.add(i);
                        else next.delete(i);
                        setSelectedRules(next);
                      }}
                      className="mt-1 w-4 h-4 accent-[#1A56DB] cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-sm border ${
                            rule.rule_type === "block"
                              ? "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]"
                              : rule.rule_type === "escalate"
                                ? "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]"
                                : rule.rule_type === "guide"
                                  ? "bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE]"
                                  : "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]"
                          }`}
                        >
                          {rule.rule_type}
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
                ))}

                <button
                  type="button"
                  onClick={handleAuthorizeSelected}
                  disabled={selectedRules.size === 0 || authorizing}
                  className="w-full bg-[#0F172A] text-white font-mono text-sm font-medium py-3 rounded-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors cursor-pointer mt-2"
                >
                  {authorizing
                    ? "Authorizing..."
                    : `Authorize ${selectedRules.size} selected rule${selectedRules.size !== 1 ? "s" : ""} →`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stats strip — Total dropped because it included deactivated rules
            (misleading); Active is now the primary stat. Deactivated lives at
            the end in muted slate so it reads as "not governing right now." */}
        <div className="flex gap-6 mt-6 pb-6 border-b border-[#E2E8F0] items-end flex-wrap">
          {[
            { value: counts.active,      label: "Active rules", muted: false },
            { value: counts.firing,      label: "Firing",       muted: false },
            { value: counts.silent,      label: "Silent",       muted: false },
            { value: counts.deactivated, label: "Deactivated",  muted: true  },
          ].map((s) => (
            <div key={s.label}>
              <div
                className={`font-mono text-3xl font-light ${
                  s.muted ? "text-[#94A3B8]" : "text-[#0F172A]"
                }`}
              >
                {s.value}
              </div>
              <div className="font-mono text-xs uppercase text-[#64748B] mt-1">{s.label}</div>
            </div>
          ))}
          <div className="ml-auto font-mono text-sm text-[#374151]">
            2 of 5 checks active · Rule Check + Quiet Period Check deterministic · Consistency Check comparing against {corpusCount} approved statements
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-6 border-b border-[#E2E8F0]">
          {([
            { key: "all" as const,         label: `All (${counts.total})` },
            { key: "active" as const,      label: `Active (${counts.active})` },
            { key: "expired" as const,     label: `Expired (${counts.expired})` },
            { key: "deactivated" as const, label: `Deactivated (${counts.deactivated})` },
          ]).map(({ key, label }) => {
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`font-mono text-sm pb-3 px-1 border-b-2 transition ${
                  selected
                    ? "border-[#1A56DB] text-[#1A56DB]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Rule cards */}
        <div className="flex flex-col gap-3 mt-6">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-sm p-12 text-center text-[#64748B] text-sm">
              No rules in this view.
            </div>
          ) : (
            filtered.map(({ rule: r, classification }) => {
              const v = (r.verdict || "review").toLowerCase();
              const stripe = VERDICT_STRIPE[v] || "bg-[#64748B]";
              const badge = VERDICT_BADGE[v] || VERDICT_BADGE.review;
              const triggers = r.trigger_count ?? 0;
              const showKeywords = r.keywords && r.keywords.length > 0 && v !== "guide";
              return (
                <div
                  key={r.id}
                  className="bg-white border border-[#E2E8F0] rounded-sm overflow-hidden flex"
                >
                  <div className={`w-1 shrink-0 ${stripe}`} aria-hidden />
                  <div className="p-5 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-medium text-[#0F172A]">{r.name}</div>
                        {r.description && (
                          <div className="text-sm text-[#374151] mt-1">{r.description}</div>
                        )}
                      </div>
                      <div className="flex gap-2 items-center shrink-0 ml-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-sm border font-mono text-xs font-bold tracking-wide ${badge.bg} ${badge.text} ${badge.border}`}>
                          {badge.label}
                        </span>
                        <span className="bg-[#EFF8FF] text-[#1447C0] border border-[#BAE6FD] font-mono text-xs px-2 py-0.5 rounded-sm">
                          {scopeLabel(r.scope)}
                        </span>
                        {triggers > 0 && (
                          <span className="bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] font-mono text-xs px-2 py-0.5 rounded-sm">
                            {triggers} {triggers === 1 ? "trigger" : "triggers"}
                          </span>
                        )}
                      </div>
                    </div>

                    {showKeywords && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {(r.keywords ?? []).map((kw) => (
                          <span
                            key={kw}
                            className="bg-[#F1F5F9] text-[#64748B] font-mono text-xs px-2 py-0.5 rounded-sm border border-[#E2E8F0]"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[#E2E8F0] flex justify-between items-center gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-[#64748B]">
                          {buildFooterText(r, classification)}
                        </div>
                        {r.wsp_reference && (
                          <div className="font-mono text-xs text-[#1447C0] mt-0.5">
                            WSP: {r.wsp_reference}
                          </div>
                        )}
                        {triggers > 0 && r.last_triggered && (
                          <div className="font-mono text-xs text-[#94A3B8] mt-0.5">
                            Last triggered: {fmtRelative(r.last_triggered)}
                          </div>
                        )}
                        {classification === "deactivated" && r.deactivated_reason && (
                          <div className="font-mono text-xs text-[#64748B] mt-0.5">
                            Reason: {r.deactivated_reason}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 shrink-0">
                        {classification === "active" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingRule(r)}
                              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(r.id)}
                              disabled={pending}
                              className="font-mono text-xs text-[#64748B] hover:text-[#B91C1C] transition cursor-pointer disabled:opacity-50"
                            >
                              {pending ? "Deactivating..." : "Deactivate"}
                            </button>
                          </>
                        )}
                        {classification === "expired" && (
                          <button
                            type="button"
                            onClick={() => alert("Renew coming soon")}
                            className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition cursor-pointer"
                          >
                            Renew
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Coming-soon — Message House. Sits above the AI-detection card so
            the alignment narrative reads as the lens through which the
            forthcoming Alignment Check will compare each draft. */}
        {(tab === "active" || tab === "all") && (
          <div className="mt-6 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
                Message House
              </div>
              <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#94A3B8] px-2 py-0.5 rounded-sm border border-[#E2E8F0]">
                Coming soon
              </span>
            </div>
            <div className="text-sm font-medium text-[#0F172A] mb-2">
              Define your organization&apos;s messaging pillars. Enforce them on every draft.
            </div>
            <div className="text-sm text-[#374151] leading-relaxed mb-4">
              Set 3–7 positioning statements that define what your organization stands for.
              ERA CUE&apos;s Alignment Check compares every draft against your message house
              — flagging contradictions before they reach the public.
            </div>
            <div className="space-y-2">
              {[
                "We are the governance layer for AI communications",
                "We prioritize human oversight over automation",
                "Compliance is a competitive advantage",
              ].map((pillar, i) => (
                <div key={pillar} className="flex items-start gap-2">
                  <span className="font-mono text-[10px] text-[#94A3B8] shrink-0 mt-0.5 w-4">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-[#94A3B8] italic">
                    &ldquo;{pillar}&rdquo;
                  </span>
                </div>
              ))}
            </div>
            <div className="font-mono text-[10px] text-[#94A3B8] mt-4">
              Alignment Check will enforce these pillars on every submission — automatically.
            </div>
          </div>
        )}

        {/* Coming-soon — AI content detection. Shown only on tabs where active
            rules are visible (Active or All). */}
        {(tab === "active" || tab === "all") && (
          <div className="mt-6 bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-3">
              COMING SOON — AI CONTENT DETECTION
            </div>
            <div className="text-sm font-medium text-[#0F172A] mb-2">
              Automatic AI-generated content detection and routing
            </div>
            <p className="text-sm text-[#64748B] mb-4 leading-relaxed">
              ERA CUE will automatically detect AI-generated content and route
              it for principal review — without requiring manual declaration.
              Agent submission fingerprinting ensures every autonomous post has
              a human checkpoint.
            </p>
            <div className="space-y-2">
              {[
                "LLM-generated content detection",
                "Agent submission fingerprinting",
                "Automatic EU AI Act Article 50 disclosure flagging",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                  <span className="font-mono text-xs text-[#64748B]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddRulePanel
        isOpen={isAddOpen || editingRule !== null}
        initialRule={editingRule}
        onClose={() => {
          setIsAddOpen(false);
          setEditingRule(null);
        }}
      />
    </main>
  );
}
