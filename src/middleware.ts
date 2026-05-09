/**
 * Auth + org-routing middleware.
 *
 * Runs on every request not matched by the matcher exclusion list at the
 * bottom of this file. Three responsibilities, in order:
 *   1. Refresh the Supabase session cookie so server components see a
 *      fresh `getSession()` result.
 *   2. Block unauthenticated users from non-public paths (redirecting
 *      to /auth/login with `next=` set so they bounce back).
 *   3. Send authenticated users without an org membership to
 *      /onboarding, and downgrade non-principal users hitting
 *      principal-only routes to /dashboard.
 *
 * Implementation notes:
 *   • Uses `@supabase/ssr` (the spec referenced auth-helpers-nextjs,
 *     which is type-incompatible with Next.js 15's async cookies API).
 *   • Public paths are matched as exact equality OR with a trailing
 *     slash — so "/auth/login" matches but "/authentication" does not.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/how-it-works",
  "/pricing",
  "/use-cases",
  "/security",
  // Public reviewer link — token-gated, no login required.
  // Reviewers receive a /review/<token> URL and decide directly.
  "/review",
];

const PRINCIPAL_ONLY_PATHS = [
  "/reviewer",
  "/rules",
  "/supervision-report",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

export async function middleware(req: NextRequest) {
  // Demo bypass: when NEXT_PUBLIC_DEMO_MODE === "true" the entire
  // product surface is public — no auth gate, no org-membership
  // redirect, no principal-only enforcement. The hosted demo deploy
  // ships with this on so prospects can click through every page
  // without an account; production deployments leave it unset.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // Without env vars configured the middleware is a pass-through — keeps
  // local dev working before the user has wired Supabase up.
  if (!url || !key) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => {
        // Update both the request (so subsequent server components see
        // the new cookie) and the response (so the browser stores it).
        for (const c of toSet) req.cookies.set(c.name, c.value);
        res = NextResponse.next({ request: req });
        for (const c of toSet) res.cookies.set(c.name, c.value, c.options);
      },
    },
  });

  // Refresh session — populates res cookies on rotation.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;

  // Public paths bypass all auth gates.
  if (isPublicPath(path)) return res;

  // Not authenticated → /auth/login with the original target preserved.
  if (!session) {
    const loginUrl = new URL("/auth/login", req.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated — check org membership.
  const { data: member } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", session.user.id)
    .maybeSingle();

  // No org → onboarding (unless they're already there).
  if (!member && !path.startsWith("/onboarding")) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Principal-only routes bounce non-principals to /dashboard.
  if (member) {
    const isPrincipalOnly = PRINCIPAL_ONLY_PATHS.some((p) => path.startsWith(p));
    if (isPrincipalOnly && member.role !== "principal") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
