/**
 * OAuth / magic-link callback. Supabase redirects here after the user
 * clicks a confirmation or magic-link email; we trade the code for a
 * session and bounce them onward to `next` (defaults to /dashboard).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/review";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
