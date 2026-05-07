/**
 * Invitation landing page. Looks up the token server-side; if valid,
 * renders the auth + accept flow as a client component (so the user
 * can hit signInWithPassword + acceptInvitationAction in sequence).
 */
import Link from "next/link";
import { lookupInvitation } from "./actions";
import { InviteAcceptClient } from "./invite-client";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const result = await lookupInvitation(token);

  if (!result.ok) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-[#E2E8F0] rounded-sm p-8 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#B91C1C] mb-2">
            Invitation unavailable
          </div>
          <div className="text-sm text-[#374151] mb-6">{result.message}</div>
          <Link
            href="/auth/login"
            className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0]"
          >
            Sign in to ERA CUE →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center px-4">
      <InviteAcceptClient token={token} invitation={result.invitation} />
    </div>
  );
}
