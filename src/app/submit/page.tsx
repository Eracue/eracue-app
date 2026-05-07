import { SubmitForm } from "./submit-form";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        {/* Demo context banner — only renders when DEMO_MODE is on. Sets
            up the visitor: pre-configured rules, fixed speaker (Marcus
            Rivera). The right-hand "Configure your own rules →" link
            steers prospects who want to set up their own; the
            "Request access →" mailto button is the primary conversion
            path for regulated firms. */}
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
          <div className="bg-[#0F172A] px-6 py-4 border-b border-white/10">
            <div className="max-w-[1100px] mx-auto flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 bg-white/10 px-2 py-1 rounded-sm">
                  Demo mode
                </span>
                <span className="text-sm text-white/60">
                  Using pre-configured governance rules. Checking as Marcus Rivera, CEO.
                </span>
              </div>
              <div className="flex items-center gap-4">
                <a
                  href="/rules"
                  className="font-mono text-xs text-white/60 hover:text-white transition-colors"
                >
                  Configure your own rules →
                </a>
                <a
                  href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
                  className="font-mono text-xs bg-[#1A56DB] text-white px-3 py-1.5 rounded-sm hover:bg-[#1447C0] transition-colors"
                >
                  Request access →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Flow breadcrumb — places the visitor in the four-step
            governance loop. Step 02 (this page) is highlighted blue;
            step 01 links to /rules; the rest are static markers. */}
        <div className="max-w-[1100px] mx-auto px-6 pt-6">
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {[
              { n: "01", label: "Configure rules", href: "/rules", active: false },
              { n: "02", label: "Check a draft", href: null, active: true },
              { n: "03", label: "Principal reviews", href: null, active: false },
              { n: "04", label: "Record created", href: null, active: false },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="text-[#E2E8F0] font-mono text-xs" aria-hidden>
                    →
                  </span>
                )}
                <div
                  className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest ${
                    step.active ? "text-[#1A56DB]" : "text-[#94A3B8]"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      step.active
                        ? "bg-[#1A56DB] text-white"
                        : "bg-[#F1F5F9] text-[#94A3B8]"
                    }`}
                  >
                    {step.n.replace("0", "")}
                  </span>
                  {step.href ? (
                    <a
                      href={step.href}
                      className="hover:text-[#1A56DB] transition-colors"
                    >
                      {step.label}
                    </a>
                  ) : (
                    <span>{step.label}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Page header */}
        <div className="max-w-[1100px] mx-auto px-6 pt-4 pb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
            PRE-PUBLICATION CHECK
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="font-light text-3xl text-[#0F172A] mb-2"
          >
            Check a draft
          </h1>
          <p className="text-sm text-[#64748B] max-w-xl mb-0">
            Paste any executive communication. ERA CUE checks it against your active governance rules in under one second.
          </p>

          {/* Collapsible "What gets checked?" — native <details>, no JS. */}
          <details className="mt-3">
            <summary className="font-mono text-xs text-[#1A56DB] cursor-pointer list-none">
              What gets checked? ▾
            </summary>
            <div className="bg-[#F8F9FB] border border-[#E2E8F0] rounded-sm p-4 mt-2 text-xs text-[#64748B] space-y-2">
              <div>
                <span className="font-medium text-[#0F172A]">Rule Check</span>
                {" "}— matches your draft against active governance rules
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">Consistency Check</span>
                {" "}— compares against prior statements from this speaker
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">Alignment Check</span>
                {" "}— checks against your defined message house
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">Quiet Period Check</span>
                {" "}— verifies no active timing restrictions apply
              </div>
              <div>
                <span className="font-medium text-[#0F172A]">Agent Origin Check</span>
                {" "}— records AI involvement for regulatory compliance
              </div>
            </div>
          </details>
        </div>
        <SubmitForm />
      </main>
    </>
  );
}
