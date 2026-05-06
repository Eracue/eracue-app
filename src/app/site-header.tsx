import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-white border-b border-[#E2E8F0] shadow-sm print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-xl tracking-tight">
            <span className="text-[#1A56DB] font-bold">ERA</span>
            <span className="text-[#1A56DB] italic font-normal"> CUE</span>
          </span>
          <span className="ml-1 text-[10px] font-mono bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-sm">
            demo
          </span>
        </Link>
        <nav className="flex items-center gap-8 text-sm font-mono text-[#64748B]">
          <Link
            href="/submit"
            className="inline-flex items-center bg-[#1A56DB] text-white font-mono text-xs font-medium px-3 py-1.5 rounded-sm hover:bg-[#1447C0] transition-colors whitespace-nowrap mr-2"
          >
            Check a draft →
          </Link>
          <Link href="/dashboard" className="hover:text-[#0F172A] transition-colors">
            Review
          </Link>
          <Link href="/rules" className="hover:text-[#0F172A] transition-colors">
            Rules
          </Link>
          <Link href="/drafts" className="hover:text-[#0F172A] transition-colors">
            Archive
          </Link>
        </nav>
      </div>
    </header>
  );
}
