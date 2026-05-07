"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-client";

/**
 * Signup is the entry point for new orgs. Submitting the form calls
 * supabase.auth.signUp(); on success the user lands on /onboarding,
 * which walks them through firm setup. The "← Try the demo first" link
 * goes back to /, where the demo bypass lets them tour the product
 * without an account.
 */
export default function SignupPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup() {
    if (!email || !password) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/onboarding");
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
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
          <div className="text-xl font-semibold text-[#0F172A] mt-3 mb-1">
            Set up ERA CUE for your team
          </div>
          <div className="text-sm text-[#64748B]">
            Takes 10 minutes. No credit card required.
          </div>
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
                placeholder="you@yourfirm.com"
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
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
                placeholder="8+ characters"
                autoComplete="new-password"
                className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
              />
            </div>

            <button
              type="button"
              onClick={handleSignup}
              disabled={loading || !email || !password}
              className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating account..." : "Get started →"}
            </button>
          </div>

          <div className="mt-4 text-center text-xs text-[#94A3B8]">
            By signing up you agree to our terms of service.
          </div>

          <div className="mt-4 text-center text-sm text-[#64748B]">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#1A56DB] hover:text-[#1447C0]">
              Sign in →
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="font-mono text-xs text-[#94A3B8] hover:text-[#64748B]"
          >
            ← Try the demo first
          </Link>
        </div>
      </div>
    </div>
  );
}
