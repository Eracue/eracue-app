import Link from "next/link";

// Static, dark-band nav — wordmark on the left, one CTA on the right.
// No auth state, no dropdown, no nav links: every internal navigation
// happens from in-page surfaces. Renders identically across every
// route the layout imports it from.
export function SiteHeader() {
  return (
    <header className="bg-[#0D1B2A] border-b border-white/[0.08] px-6 md:px-12 py-4 print:hidden">
      <div className="max-w-[1100px] mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[13px] text-white tracking-[0.06em]"
          aria-label="ERA CUE — home"
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-light text-[#A5B4FC]"> CUE</span>
        </Link>

        <Link
          href="/rules"
          className="bg-[#1A56DB] text-white font-mono text-[11px] font-medium px-4 py-2 rounded-sm hover:bg-[#1447C0] hover:shadow-[0_0_0_3px_rgba(26,86,219,0.25)] transition-all"
        >
          Set up your rules →
        </Link>
      </div>
    </header>
  );
}
