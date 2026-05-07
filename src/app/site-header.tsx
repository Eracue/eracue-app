"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-client";

// Authed users get the full app nav. Unauthed users see only the
// "Check a draft →" CTA on the right — no other nav links, no demo
// pill, no mailto. The middleware demo-bypass means the CTA actually
// lands the visitor on the live submit form without an auth gate.
const NAV_LINKS_AUTHED = [
  { href: "/dashboard", label: "Review" },
  { href: "/rules", label: "Rules" },
  { href: "/drafts", label: "Archive" },
] as const;

type Member = {
  org_name: string | null;
  display_name: string | null;
};

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // null = still hydrating; suppress the auth-dependent slots until we know.
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Hydrate session + org membership client-side. Re-runs on auth state
  // changes so signing out reflects in the header without a full reload.
  useEffect(() => {
    const supabase = createBrowserClient();
    let cancelled = false;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setAuthed(false);
        setEmail(null);
        setMember(null);
        return;
      }
      setAuthed(true);
      setEmail(session.user.email ?? null);

      const { data: m } = await supabase
        .from("org_members")
        .select("display_name, orgs(name)")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const row = m as
        | { display_name: string | null; orgs: { name: string | null } | { name: string | null }[] | null }
        | null;
      const orgsField = row?.orgs ?? null;
      const orgName = Array.isArray(orgsField)
        ? orgsField[0]?.name ?? null
        : orgsField?.name ?? null;
      setMember({
        display_name: row?.display_name ?? null,
        org_name: orgName,
      });
    }

    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Close the user menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const userInitial = (member?.display_name || email || "?").charAt(0).toUpperCase();
  // Only authed users get a nav-links list. Unauthed users see no
  // navigation links in the header — the right-hand CTAs are the only
  // way through the page.
  const navLinks = authed ? NAV_LINKS_AUTHED : [];

  return (
    <header className="relative bg-white border-b border-[#E2E8F0] shadow-sm print:hidden">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-newsreader)" }} className="text-xl tracking-tight">
            <span className="text-[#1A56DB] font-bold">ERA</span>
            <span className="text-[#1A56DB] italic font-normal"> CUE</span>
          </span>
          {authed && member?.org_name && (
            <span className="font-mono text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-sm border border-[#E2E8F0] ml-2">
              {member.org_name}
            </span>
          )}
        </Link>

        {/* Desktop nav — hidden below md, where the hamburger takes over.
            "Check a draft →" renders for everyone once auth state has
            resolved. Authed users also get Review / Rules / Archive +
            user menu. Unauthed users see ONLY the Check a draft button
            on the right. The authed === null case (still hydrating)
            suppresses everything so we don't flash unauthed state for
            logged-in users. */}
        <nav className="hidden md:flex items-center gap-6">
          {authed !== null && (
            <Link
              href="/submit"
              className="inline-flex items-center bg-[#1A56DB] text-white font-mono text-xs font-medium px-4 py-1.5 rounded-sm hover:bg-[#1447C0] transition-colors whitespace-nowrap"
            >
              Check a draft →
            </Link>
          )}
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              {item.label}
            </Link>
          ))}

          {authed === true && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="User menu"
                aria-expanded={menuOpen}
                className="w-8 h-8 rounded-full bg-[#1A56DB] text-white font-mono text-xs font-bold flex items-center justify-center hover:bg-[#1447C0] transition-colors cursor-pointer"
              >
                {userInitial}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E8F0] rounded-sm shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-[#E2E8F0]">
                    <div className="text-sm font-medium text-[#0F172A] truncate">
                      {member?.display_name ?? email ?? "—"}
                    </div>
                    {email && member?.display_name && (
                      <div className="font-mono text-[10px] text-[#64748B] truncate">{email}</div>
                    )}
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-[#374151] hover:bg-[#F8F9FB] transition-colors"
                  >
                    Settings
                  </Link>
                  <form action="/auth/signout" method="post" className="border-t border-[#E2E8F0]">
                    <button
                      type="submit"
                      className="w-full text-left px-4 py-2 text-sm text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
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
          spans the full width below the row. Each tap closes it.
          Pre-launch surface: "Check a draft" (blue) for everyone +
          authed app nav + Sign out. Unauthed users see only the Check
          a draft button. */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-[#E2E8F0] shadow-sm z-50 py-3 px-6">
          <div className="flex flex-col gap-1">
            {authed !== null && (
              <Link
                href="/submit"
                onClick={() => setOpen(false)}
                className="bg-[#1A56DB] text-white font-mono text-sm font-medium px-4 py-3 rounded-sm text-center hover:bg-[#1447C0] transition-colors mb-2"
              >
                Check a draft →
              </Link>
            )}
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-mono text-sm text-[#374151] py-3 px-1 border-b border-[#F1F5F9] last:border-0 hover:text-[#0F172A] transition-colors block"
              >
                {item.label}
              </Link>
            ))}
            {authed === true && (
              <form action="/auth/signout" method="post" className="mt-3">
                <button
                  type="submit"
                  className="w-full font-mono text-sm text-[#B91C1C] py-3 text-left cursor-pointer"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
