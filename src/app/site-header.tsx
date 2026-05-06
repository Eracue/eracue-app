"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/dashboard", label: "Review" },
  { href: "/rules", label: "Rules" },
  { href: "/drafts", label: "Archive" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative bg-white border-b border-[#E2E8F0] shadow-sm print:hidden">
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

        {/* Desktop nav — hidden below md, where the hamburger takes over. */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/submit"
            className="inline-flex items-center bg-[#1A56DB] text-white font-mono text-xs font-medium px-3 py-1.5 rounded-sm hover:bg-[#1447C0] transition-colors whitespace-nowrap"
          >
            Check a draft →
          </Link>
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile hamburger — toggles the dropdown panel below the header. */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="md:hidden flex items-center justify-center w-10 h-10 text-[#64748B] hover:text-[#0F172A] transition-colors"
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          {open ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown — anchored to the header's relative wrapper so it
          spans the full width below the row. Each tap closes it. */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-[#E2E8F0] shadow-sm z-50 py-3 px-6">
          <div className="flex flex-col gap-1">
            <Link
              href="/submit"
              onClick={() => setOpen(false)}
              className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-4 py-3 rounded-sm text-center hover:bg-[#1447C0] transition-colors mb-2"
            >
              Check a draft →
            </Link>
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-mono text-sm text-[#374151] py-3 px-1 border-b border-[#F1F5F9] last:border-0 hover:text-[#0F172A] transition-colors block"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
