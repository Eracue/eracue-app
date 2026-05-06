import { SubmitForm } from "./submit-form";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F8F9FB]">
        {/* Page header */}
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
          <div className="font-mono text-xs uppercase tracking-widest text-[#64748B] mb-2">
            PRE-PUBLICATION CHECK
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="font-light text-3xl text-[#0F172A] mb-2"
          >
            Check this draft before it goes live.
          </h1>
          <p className="text-sm text-[#64748B] max-w-xl mb-0">
            Paste any executive communication. ERA CUE checks it against your
            governance rules, flags violations, and routes it to your designated
            principal — before it reaches the public.
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
