import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-white border-b border-[#E2E8F0] print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-lg font-light tracking-tight">
            <span className="text-[#1A56DB]">ERA</span>
            <span className="text-[#1A56DB] italic"> CUE</span>
          </span>
          <span className="text-[10px] font-mono bg-[#F1F5F9] text-[#94A3B8] px-1.5 py-0.5 rounded-sm">
            demo
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-xs font-mono text-[#64748B]">
          <Link href="/dashboard" className="hover:text-[#0F172A] transition-colors">
            Dashboard
          </Link>
          <Link href="/rules" className="hover:text-[#0F172A] transition-colors">
            Rules
          </Link>
          <Link href="/drafts" className="hover:text-[#0F172A] transition-colors">
            Drafts
          </Link>
        </nav>
      </div>
    </header>
  );
}
