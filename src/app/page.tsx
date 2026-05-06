import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";

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
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {/* Top brand line */}
        <div className="mb-12">
          <div className="text-sm text-neutral-500 tracking-widest uppercase">ERA CUE</div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-neutral-900 mt-3 leading-tight max-w-3xl">
            The record that proves someone checked.
          </h1>
        </div>

        {/* Problem + product framing */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 pb-12 border-b border-neutral-200">
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">The problem</div>
            <p className="text-base text-neutral-700 leading-relaxed">
              Every draft your executives publish is a regulatory exposure. The decision to ship it almost never has a record. FINRA fined firms over $600M for off-channel communications. The EU AI Act now requires logging every AI-assisted decision affecting customers.
            </p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">The system</div>
            <p className="text-base text-neutral-700 leading-relaxed">
              ERA CUE is the governed moment between AI generation and publication. Five checks fire on every draft. Every decision is logged with a SHA-256 hash. Every record holds up to an examiner.
            </p>
          </div>
        </div>

        {/* Live counter */}
        <div className="mb-12">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-4">In this demo organization</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-neutral-200 border border-neutral-200 rounded-lg overflow-hidden">
            <div className="bg-white p-4">
              <div className="text-xs text-neutral-500">Rules active</div>
              <div className="text-2xl font-light text-neutral-900 mt-1">{stats.rulesActive}</div>
            </div>
            <div className="bg-white p-4">
              <div className="text-xs text-neutral-500">Drafts reviewed</div>
              <div className="text-2xl font-light text-neutral-900 mt-1">{stats.draftsTotal}</div>
            </div>
            <div className="bg-white p-4">
              <div className="text-xs text-red-700">Blocked</div>
              <div className="text-2xl font-light text-neutral-900 mt-1">{stats.draftsBlocked}</div>
            </div>
            <div className="bg-white p-4">
              <div className="text-xs text-amber-700">Escalated</div>
              <div className="text-2xl font-light text-neutral-900 mt-1">{stats.draftsEscalated}</div>
            </div>
            <div className="bg-white p-4">
              <div className="text-xs text-purple-700">Overridden</div>
              <div className="text-2xl font-light text-neutral-900 mt-1">{stats.draftsOverridden}</div>
            </div>
          </div>
        </div>

        {/* Principal CTA — the GC's home base */}
        <div className="mb-12">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Start here</div>
          <Link href="/dashboard" className="block bg-neutral-900 text-white rounded-lg p-6 hover:bg-neutral-800 transition group">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Principal · General Counsel</div>
                <div className="text-xl font-medium">Open the principal dashboard →</div>
                <div className="text-sm text-neutral-300 mt-2">See every speaker&apos;s drafts coordinated by campaign. Spot conflicts before they ship.</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Workflow */}
        <div>
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3">Workflow</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Link href="/submit" className="block bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-400 hover:shadow-sm transition">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Speaker</div>
              <div className="text-sm font-medium text-neutral-900">Submit a draft</div>
              <div className="text-xs text-neutral-500 mt-2">Pre-publication review</div>
            </Link>
            <Link href="/drafts" className="block bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-400 hover:shadow-sm transition">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">System</div>
              <div className="text-sm font-medium text-neutral-900">View drafts &amp; verdicts</div>
              <div className="text-xs text-neutral-500 mt-2">All checks logged</div>
            </Link>
            <Link href="/reviewer/queue" className="block bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-400 hover:shadow-sm transition">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Reviewer</div>
              <div className="text-sm font-medium text-neutral-900">Reviewer queue</div>
              <div className="text-xs text-neutral-500 mt-2">Override or confirm</div>
            </Link>
            <Link href="/rules" className="block bg-white border border-neutral-200 rounded-lg p-5 hover:border-neutral-400 hover:shadow-sm transition">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Authority</div>
              <div className="text-sm font-medium text-neutral-900">Governance rules</div>
              <div className="text-xs text-neutral-500 mt-2">Authorized policies</div>
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-16 pt-8 border-t border-neutral-200 text-xs text-neutral-500">
          Demo data. No live customer information. The append-only audit trail and SHA-256 row hashes shown here are real database constraints.
        </div>
      </div>
    </main>
  );
}
