"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // After confirming, where should the user land? Default = onboarding
  // (signup is the first-org flow); /auth/invite/[token] passes its own
  // `next` so accepted-invite users go straight to /dashboard.
  const next = searchParams.get("next") || "/onboarding";

  async function handleSignup() {
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // If Supabase has email-confirmation enabled, `session` will be null
    // and we show a "check your email" state. If it's disabled (dev /
    // demo) the session is live immediately and we send them onward.
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      setEmailSent(true);
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="max-w-sm w-full bg-white border border-[#E2E8F0] rounded-sm p-8 text-center">
        <div className="text-2xl mb-2" aria-hidden>✉️</div>
        <div className="text-base font-semibold text-[#0F172A] mb-2">
          Check your email to confirm your account
        </div>
        <div className="text-sm text-[#64748B]">
          We sent a confirmation link to <strong>{email}</strong>. After you
          confirm, you&apos;ll be taken to onboarding.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-sm w-full">
      <div className="text-center mb-8">
        <Link
          href="/"
          className="font-mono text-lg text-[#1A56DB] inline-block"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-normal"> CUE</span>
        </Link>
        <div className="text-sm text-[#64748B] mt-1">Get started — create your account</div>
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
              htmlFor="signup-email"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Work email
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              autoComplete="email"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
          </div>

          <div>
            <label
              htmlFor="signup-password"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
          </div>

          <div>
            <label
              htmlFor="signup-confirm"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
          </div>

          <button
            type="button"
            onClick={handleSignup}
            disabled={loading || !email || !password || !confirm}
            className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating account..." : "Create account →"}
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-[#64748B]">
          Already have an account?{" "}
          <Link
            href={`/auth/login${next !== "/onboarding" ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-[#1A56DB] hover:text-[#1447C0]"
          >
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
      <Suspense fallback={<div className="font-mono text-xs text-[#94A3B8]">Loading…</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
