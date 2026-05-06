"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddRulePanel } from "./add-rule-panel";
import { deactivateRuleAction } from "./actions";

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
              disabled
              className="bg-white border border-[#E2E8F0] text-[#64748B] text-sm px-4 py-2 rounded-sm relative cursor-default"
            >
              Import from document
              <span className="ml-2 font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-sm">
                Soon
              </span>
            </button>
          </div>
        </div>

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
