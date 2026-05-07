import Link from "next/link";

// Static, dark-band nav. Wordmark only — every internal navigation
// happens from in-page surfaces (hero CTAs, in-section links, the
// bottom CTA). Renders identically across every route the layout
// imports it from.
export function SiteHeader() {
  return (
    <header className="bg-[#0D1B2A] border-b border-white/[0.07] px-6 md:px-12 py-4 print:hidden">
      <div className="max-w-[1100px] mx-auto flex items-center">
        <Link
          href="/"
          className="font-mono text-[13px] text-white tracking-[0.06em]"
          aria-label="ERA CUE — home"
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-light"> CUE</span>
        </Link>
      </div>
    </header>
  );
}
