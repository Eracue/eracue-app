import Link from "next/link";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { getSupabaseAdmin } from "@/lib/checks";
import { RulesFilter } from "./rules-filter";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RuleRow = {
 id: string;
 rule_type: "block" | "escalate" | "review" | "guide";
 name: string;
 description: string;
 keywords: string[];
 effective_from: string;
 effective_to: string | null;
 created_at: string;
 created_by: string | null;
 users: { name: string; title: string | null } | null;
};

type PageProps = {
 searchParams: Promise<{ filter?: string }>;
};

async function getRules(filter: "active" | "all") {
 const sb = getSupabaseAdmin();
 const { data, error } = await sb
 .from("rules")
 .select("id, rule_type, name, description, keywords, effective_from, effective_to, created_at, created_by, users:created_by(name, title)")
 .eq("org_id", DEMO_ORG_ID)
 .order("rule_type")
 .order("name");
 if (error) throw new Error(error.message);

 const rules = (data || []) as unknown as RuleRow[];

 if (filter === "all") return rules;

 // Active = effective_from <= now AND (effective_to IS NULL OR effective_to >= now)
 const now = Date.now();
 return rules.filter((r) => {
 const fromTime = new Date(r.effective_from).getTime();
 if (now < fromTime) return false;
 if (r.effective_to) {
 const toTime = new Date(r.effective_to).getTime();
 if (now > toTime) return false;
 }
 return true;
 });
}

function ruleTypeBadge(type: string) {
 const styles: Record<string, { bg: string; text: string; border: string; label: string; verb: string }> = {
 block: { bg: "bg-[#FEF2F2]", text: "text-[#B91C1C]", border: "border-[#FECACA]", label: "BLOCK", verb: "Hard-stop" },
 escalate: { bg: "bg-[#FFF7ED]", text: "text-[#C2410C]", border: "border-[#FED7AA]", label: "ESCALATE", verb: "Route to reviewer" },
 review: { bg: "bg-[#EFF6FF]", text: "text-[#1D4ED8]", border: "border-[#BFDBFE]", label: "REVIEW", verb: "Queue for review" },
 guide: { bg: "bg-[#F5F3FF]", text: "text-[#6D28D9]", border: "border-[#DDD6FE]", label: "GUIDE", verb: "Advisory" },
 };
 return styles[type] || styles.guide;
}

function fmtDate(iso: string): string {
 return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function ruleStatus(rule: RuleRow): { label: string; tone: "active" | "future" | "expired" } {
 const now = Date.now();
 const fromTime = new Date(rule.effective_from).getTime();
 if (now < fromTime) return { label: `Starts ${fmtDate(rule.effective_from)}`, tone: "future" };
 if (rule.effective_to) {
 const toTime = new Date(rule.effective_to).getTime();
 if (now > toTime) return { label: `Expired ${fmtDate(rule.effective_to)}`, tone: "expired" };
 return { label: `Active until ${fmtDate(rule.effective_to)}`, tone: "active" };
 }
 return { label: "Active — no end date", tone: "active" };
}

export default async function RulesPage({ searchParams }: PageProps) {
 const params = await searchParams;
 const filter: "active" | "all" = params.filter === "all" ? "all" : "active";
 const rules = await getRules(filter);

 // Group by rule_type
 const byType = new Map<string, RuleRow[]>();
 for (const r of rules) {
 if (!byType.has(r.rule_type)) byType.set(r.rule_type, []);
 byType.get(r.rule_type)!.push(r);
 }

 // Order: block, escalate, review, guide
 const typeOrder: Array<"block" | "escalate" | "review" | "guide"> = ["block", "escalate", "review", "guide"];

 // Counts
 const counts = {
 total: rules.length,
 block: byType.get("block")?.length || 0,
 escalate: byType.get("escalate")?.length || 0,
 review: byType.get("review")?.length || 0,
 guide: byType.get("guide")?.length || 0,
 };

 // Find the principal name (whoever authored these — first non-null author)
 const principal = rules.find((r) => r.users)?.users;

 return (
 <>
 <SiteHeader />
 <main className="min-h-screen bg-[#F7F6F3]">
 <div className="max-w-4xl mx-auto px-6 py-12">
 <div className="mb-8">
 <Link href="/" className="text-sm text-[#6E6E68] hover:text-[#1C1C1A]">← Home</Link>
 <h1 className="text-3xl font-light tracking-tight text-[#1C1C1A] mt-2">
 Governance rules
 </h1>
 <p className="text-sm text-[#6E6E68] mt-1">
 {principal ? `Authorized by ${principal.name}${principal.title ? `, ${principal.title}` : ""}` : "Authorized by org principal"}
 </p>
 <p className="text-sm text-[#6E6E68] mt-3 max-w-2xl">
 One principal. Every speaker. These rules govern what your entire team can say — before anything goes live. Sarah Chen, GC holds authority over all 6 policies.
 </p>
 </div>

 {/* Counts hero */}
 <div className="grid grid-cols-5 gap-3 mb-6">
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide">Total</div>
 <div className="text-2xl font-light text-[#1C1C1A] mt-1">{counts.total}</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 <div className="text-xs text-[#B91C1C] uppercase tracking-wide">Block</div>
 <div className="text-2xl font-light text-[#1C1C1A] mt-1">{counts.block}</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 <div className="text-xs text-[#C2410C] uppercase tracking-wide">Escalate</div>
 <div className="text-2xl font-light text-[#1C1C1A] mt-1">{counts.escalate}</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 <div className="text-xs text-[#1D4ED8] uppercase tracking-wide">Review</div>
 <div className="text-2xl font-light text-[#1C1C1A] mt-1">{counts.review}</div>
 </div>
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-4">
 <div className="text-xs text-[#6D28D9] uppercase tracking-wide">Guide</div>
 <div className="text-2xl font-light text-[#1C1C1A] mt-1">{counts.guide}</div>
 </div>
 </div>

 {/* Engine coverage explainer */}
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-5 mb-6">
 <div className="text-xs text-[#6E6E68] uppercase tracking-wide mb-2">Engine coverage</div>
 <p className="text-sm text-[#1C1C1A] mb-3">
 Of <span className="font-medium">5 governance checks</span>, <span className="font-medium">2 are evaluating these rules today</span>.
 </p>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#6E6E68]">
 <div>
 <div className="font-medium text-[#166534] mb-1">Active</div>
 <ul className="space-y-1">
 <li>✓ Keyword Check — matches rule keywords against draft text</li>
 <li>✓ Timing Check — verifies rule is effective at submission</li>
 </ul>
 </div>
 <div>
 <div className="font-medium text-[#1C1C1A] mb-1">Available with customer data</div>
 <ul className="space-y-1 text-[#6E6E68]">
 <li>○ Consistency Check — requires prior statement corpus</li>
 <li>○ Audience Check — requires audience profile</li>
 <li>○ Alignment Check — requires narrative profile</li>
 </ul>
 </div>
 </div>
 </div>

 <RulesFilter currentFilter={filter} />

 {/* Rules grouped by type */}
 <div className="space-y-8">
 {typeOrder.map((type) => {
 const rulesOfType = byType.get(type);
 if (!rulesOfType || rulesOfType.length === 0) return null;
 const style = ruleTypeBadge(type);
 return (
 <section key={type}>
 <div className="flex items-baseline justify-between mb-3">
 <h2 className={`text-xs font-bold uppercase tracking-widest ${style.text}`}>
 {style.label} <span className="text-[#6E6E68] font-normal">— {style.verb}</span>
 </h2>
 <span className="text-xs text-[#6E6E68]">{rulesOfType.length}</span>
 </div>
 <div className="space-y-3">
 {rulesOfType.map((r) => {
 const status = ruleStatus(r);
 return (
 <div key={r.id} className="bg-white border border-[#E2E1DC] rounded-sm p-5">
 <div className="flex items-start justify-between gap-4 mb-2">
 <div>
 <h3 className="text-sm font-medium text-[#1C1C1A]">{r.name}</h3>
 <p className="text-sm text-[#6E6E68] mt-1">{r.description}</p>
 </div>
 <span className={`shrink-0 inline-flex items-center px-2 py-1 rounded text-xs font-bold tracking-wide ${style.bg} ${style.text} border ${style.border}`}>
 {style.label}
 </span>
 </div>

 {r.keywords && r.keywords.length > 0 && (
 <div className="mt-3">
 <div className="text-xs text-[#6E6E68] mb-1">Keywords</div>
 <div className="flex flex-wrap gap-1.5">
 {r.keywords.map((kw, i) => (
 <span key={i} className="font-mono text-xs bg-[#F0EFE9] text-[#1C1C1A] px-2 py-0.5 rounded">
 {kw}
 </span>
 ))}
 </div>
 </div>
 )}

 <div className="mt-3 pt-3 border-t border-[#E2E1DC]">
 <div className="font-mono text-xs text-[#6E6E68] mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
 <span className={status.tone === "expired" ? "text-[#6E6E68]" : status.tone === "future" ? "text-[#6E6E68]" : "text-[#166534]"}>
 {status.label}
 </span>
 {r.users && (
 <>
 <span aria-hidden>·</span>
 <span>Authorized by {r.users.name}{r.users.title ? `, ${r.users.title}` : ""}</span>
 </>
 )}
 <span aria-hidden>·</span>
 <span>Applies to: All speakers</span>
 </div>
 <div className="text-xs text-[#6E6E68]">
 <span className="text-[#6E6E68]">Evaluated by:</span>{" "}
 {r.keywords && r.keywords.length > 0 ? (
 <span>Keyword Check + Timing Check</span>
 ) : (
 <span>
 <span className="text-[#6E6E68]">Alignment Check</span>
 <span className="text-[#6E6E68] italic"> (available)</span>
 <span> + Timing Check</span>
 </span>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </section>
 );
 })}
 </div>

 {rules.length === 0 && (
 <div className="bg-white border border-[#E2E1DC] rounded-sm p-12 text-center text-[#6E6E68]">
 {filter === "active" ? "No rules are active right now." : "No rules in this org."}
 </div>
 )}
 </div>
 </main>
 </>
 );
}
