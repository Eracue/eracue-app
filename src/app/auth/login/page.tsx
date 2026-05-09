"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-client";

// ---------- Inner form -----------------------------------------------------

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  // The middleware sets `next=` on the login redirect so we bounce back
  // to the originally requested page. Default to /dashboard.
  const next = searchParams.get("next") || "/review";

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  }

  if (magicSent) {
    return (
      <div className="max-w-sm w-full bg-white border border-[#E2E8F0] rounded-sm p-8 text-center">
        <div className="text-2xl mb-2" aria-hidden>✉️</div>
        <div className="text-base font-semibold text-[#0F172A] mb-2">
          Check your email
        </div>
        <div className="text-sm text-[#64748B]">
          We sent a login link to <strong>{email}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm w-full">
      {/* Logo */}
      <div className="text-center mb-8">
        <Link
          href="/"
          className="font-mono text-lg text-[#1A56DB] inline-block"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-normal"> CUE</span>
        </Link>
        <div className="text-sm text-[#64748B] mt-1">Sign in to your account</div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
        {error && (
          <div
            className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-sm px-3 py-2 mb-4"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="login-email"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="you@firm.com"
              autoComplete="email"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
          </div>

          <button
            type="button"
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : "Sign in →"}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 font-mono text-[#94A3B8]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="w-full bg-white border border-[#E2E8F0] text-[#374151] font-mono text-sm py-2.5 rounded-sm hover:bg-[#F8F9FB] disabled:opacity-50 transition-colors"
          >
            Email me a login link
          </button>
        </div>

        {/* Public self-serve signup is disabled pre-launch — invitations
            come via the principal. Anyone here without an account is
            routed to the access mailto so we capture the lead. */}
        <div className="mt-6 text-center text-sm text-[#64748B]">
          Want access?{" "}
          <a
            href="mailto:hello@eracue.com?subject=ERA%20CUE%20Access%20Request"
            className="text-[#1A56DB] hover:text-[#1447C0]"
          >
            Request it →
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------- Page wrapper (Suspense for useSearchParams) -------------------

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
      <Suspense fallback={<div className="font-mono text-xs text-[#94A3B8]">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
