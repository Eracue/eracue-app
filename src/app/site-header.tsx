import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="bg-white border-b border-[#E2E1DC] print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Logo mark — indigo square */}
          <span className="inline-flex items-center justify-center w-6 h-6 bg-[#4F46E5] rounded-sm shrink-0">
            <span className="text-white font-mono text-[9px] font-bold tracking-tight leading-none">EC</span>
          </span>
          <span
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-lg font-light text-[#1C1C1A] tracking-tight"
          >
            ERA CUE
          </span>
          <span className="text-xs font-mono bg-[#F0EFE9] text-[#6E6E68] px-2 py-0.5 rounded-sm">
            demo
          </span>
        </Link>
        <nav className="flex items-center gap-6 text-xs font-mono text-[#6E6E68]">
          <Link href="/dashboard" className="hover:text-[#1C1C1A] transition-colors">
            Dashboard
          </Link>
          <Link href="/rules" className="hover:text-[#1C1C1A] transition-colors">
            Rules
          </Link>
          <Link href="/reviewer/queue" className="hover:text-[#1C1C1A] transition-colors">
            Reviewer
          </Link>
        </nav>
      </div>
    </header>
  );
}
