import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { ThemeToggle } from "./theme-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getStats() {
  const sb = getSupabaseAdmin();
  const [rulesActive, draftsTotal, draftsBlocked, draftsEscalated, draftsOverridden] = await Promise.all([
    sb.from("rules").select("*", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID),
    sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID),
    sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID).eq("status", "blocked"),
    sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID).eq("status", "escalated"),
    sb.from("drafts").select("*", { count: "exact", head: true }).eq("org_id", DEMO_ORG_ID).eq("status", "overridden"),
  ]);
  return {
    rulesActive: rulesActive.count || 0,
    draftsTotal: draftsTotal.count || 0,
    draftsBlocked: draftsBlocked.count || 0,
    draftsEscalated: draftsEscalated.count || 0,
    draftsOverridden: draftsOverridden.count || 0,
  };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-[#F5F4F0] dark:bg-[#0F0F12] text-neutral-900 dark:text-neutral-100">
      {/* Top bar */}
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl text-indigo-700 dark:text-indigo-400" style={{ fontFamily: "var(--font-newsreader)" }}>
            ERA CUE
          </span>
          <span className="inline-block w-12 h-0.5 bg-amber-700 dark:bg-amber-400 ml-1 mb-1" />
        </div>
        <ThemeToggle />
      </div>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="font-serif text-5xl md:text-6xl font-light tracking-tight text-neutral-900 dark:text-neutral-50 leading-[1.1] mb-6" style={{ fontFamily: "var(--font-newsreader)" }}>
          The record that proves<br />someone checked.
        </h1>
        <p className="text-lg text-neutral-700 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-8">
          ERA CUE governs the moment between AI-generated drafts and publication. Every check logged. Every decision recorded. Every record FINRA-defensible.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/dashboard" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-medium rounded-md transition">
            Open the principal dashboard →
          </Link>
          <Link href="/submit" className="px-6 py-3 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 text-sm font-medium rounded-md hover:border-neutral-500 transition">
            Submit a draft
          </Link>
        </div>
      </div>

      {/* Hero visual — mock verdict card */}
      <div className="max-w-2xl mx-auto px-6 pb-16">
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Verdict</div>
            <span className="inline-flex items-center px-3 py-1 rounded text-xs font-bold tracking-wide bg-red-50 text-red-900 border border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-900">
              BLOCK
            </span>
          </div>
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Series B Quiet Period</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">No hiring, growth, or fundraising language during quiet period.</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
              Matched keyword: <span className="font-mono bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">hiring</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Checks performed</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400"><span className="font-medium text-neutral-900 dark:text-neutral-100">2 of 5</span> active</div>
            </div>
            <ul className="space-y-2">
              {[
                { name: "Rule Check", status: "active", detail: "1 rule matched" },
                { name: "Quiet Period Check", status: "active", detail: "Series B Quiet Period matched" },
                { name: "Consistency Check", status: "available", detail: "AI · available" },
                { name: "Alignment Check", status: "available", detail: "AI · available" },
                { name: "Agent Origin Check", status: "available", detail: "AI · available" },
              ].map((c) => (
                <li key={c.name} className="flex items-center gap-3 text-sm">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${c.status === "active" ? "bg-green-100 text-green-800 border border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border border-neutral-200 dark:border-neutral-700"}`}>
                    {c.status === "active" ? "✓" : "○"}
                  </div>
                  <div className="flex-1 flex items-baseline justify-between">
                    <span className={c.status === "active" ? "text-neutral-900 dark:text-neutral-100 font-medium" : "text-neutral-500 dark:text-neutral-400"}>{c.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">{c.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Workflow */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-4 text-center">Workflow</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { role: "Speaker",   action: "Submit a draft",      href: "/submit",          note: "Pre-publication check" },
            { role: "System",    action: "View drafts",         href: "/drafts",          note: "All verdicts logged" },
            { role: "Reviewer",  action: "Reviewer queue",      href: "/reviewer/queue",  note: "Blocked and escalated drafts awaiting a named principal's decision. Structured review with full audit trail." },
            { role: "Principal", action: "Principal dashboard", href: "/dashboard",       note: "Governance oversight — rules, reviewer activity, gap report" },
          ].map((step) => (
            <Link key={step.role} href={step.href} className="block bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-5 hover:border-indigo-400 dark:hover:border-indigo-500 transition">
              <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">{step.role}</div>
              <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{step.action} →</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{step.note}</div>
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link href="/rules" className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline">
            Manage governance rules →
          </Link>
        </div>
      </div>

      {/* Stats strip — small */}
      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="text-[11px] tracking-widest uppercase text-neutral-500 dark:text-neutral-400 text-center">
          {stats.rulesActive} rules active · {stats.draftsTotal} drafts reviewed · {stats.draftsBlocked} blocked · {stats.draftsEscalated} escalated · {stats.draftsOverridden} overridden
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto px-6 py-8 border-t border-neutral-200 dark:border-neutral-800">
        <div className="text-xs text-amber-700 dark:text-amber-400">
          Demo data only. No live customer information. Append-only audit trail and SHA-256 row hashes are real database constraints.
        </div>
      </div>
    </div>
  );
}
