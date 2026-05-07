"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase-client";
import { acceptInvitationAction } from "./actions";

type Invitation = {
  id: string;
  email: string;
  role: string;
  title: string | null;
  display_name: string | null;
  org_id: string;
  org_name: string;
  invited_by_name: string | null;
  expires_at: string;
  accepted_at: string | null;
};

type Mode = "signin" | "signup";

export function InviteAcceptClient({
  token,
  invitation,
}: {
  token: string;
  invitation: Invitation;
}) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState(invitation.email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!email || !password) {
      setError("Email and password required.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);

    // 1. Auth: sign up or sign in with the invited email.
    const authResult =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/invite/${token}`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    if (authResult.error) {
      setError(authResult.error.message);
      setLoading(false);
      return;
    }

    // If email confirmation is on and the user just signed up, we don't
    // have a session yet — they need to click the confirmation link
    // (which routes back here, where they can sign in).
    if (mode === "signup" && !authResult.data.session) {
      setError(
        "Check your email to confirm your account, then return to this link to accept the invitation.",
      );
      setLoading(false);
      return;
    }

    // 2. Accept the invitation server-side.
    const accept = await acceptInvitationAction(token);
    if (!accept.ok) {
      setError(accept.error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="max-w-md w-full">
      <div className="text-center mb-6">
        <Link
          href="/"
          className="font-mono text-lg text-[#1A56DB] inline-block"
          style={{ fontFamily: "var(--font-newsreader)" }}
        >
          <span className="font-bold">ERA</span>
          <span className="italic font-normal"> CUE</span>
        </Link>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#1A56DB] mb-2">
          Invitation
        </div>
        <div
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="font-light text-xl text-[#0F172A] mb-2"
        >
          You&apos;ve been invited to{" "}
          <span className="font-medium">{invitation.org_name}</span>.
        </div>
        <div className="text-sm text-[#374151] mb-4 leading-relaxed">
          {invitation.invited_by_name ? `${invitation.invited_by_name} invited you` : "You were invited"}
          {" to join ERA CUE as "}
          <span className="font-medium text-[#0F172A]">
            {invitation.role === "principal" ? "a principal" : "a speaker"}
          </span>
          {invitation.title ? ` (${invitation.title})` : ""}.
        </div>

        {/* Mode tabs — sign up by default since most invitees won't have an account yet. */}
        <div className="flex bg-[#F1F5F9] rounded-sm p-1 gap-1 mb-5 w-fit">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`font-mono text-xs px-3 py-1 rounded-sm transition-colors ${
                mode === m ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {m === "signup" ? "Create account" : "I already have an account"}
            </button>
          ))}
        </div>

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
              htmlFor="invite-email"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            />
            <div className="font-mono text-[10px] text-[#94A3B8] mt-1">
              Must match the invited address ({invitation.email}).
            </div>
          </div>

          <div>
            <label
              htmlFor="invite-password"
              className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
            >
              Password
            </label>
            <input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            />
          </div>

          {mode === "signup" && (
            <div>
              <label
                htmlFor="invite-confirm"
                className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="invite-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                autoComplete="new-password"
                className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !email || !password || (mode === "signup" && !confirm)}
            className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Working..."
              : mode === "signup"
                ? "Create account & accept →"
                : "Sign in & accept →"}
          </button>
        </div>
      </div>
    </div>
  );
}
