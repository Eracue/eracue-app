/**
 * Server-side Supabase client factory.
 *
 * Built on `@supabase/ssr` (the supported successor to
 * `@supabase/auth-helpers-nextjs`, which is type-incompatible with
 * Next.js 15's async `cookies()` API). Same public function shape as
 * the spec calls for: `createServerClient()` returns a Supabase client
 * scoped to the current request's session cookie.
 *
 * Use this from server components / route handlers when you need to
 * read auth state. For privileged service-role operations (insert into
 * actions, write across orgs, etc.) keep using `getSupabaseAdmin` from
 * `@/lib/checks` or `@/lib/supabase`.
 */
import { createServerClient as createSsrServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (or _PUBLISHABLE_KEY).",
    );
  }
  return createSsrServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // In server components Next.js disallows mutating cookies via the
        // store — we swallow the resulting error so reads still work. The
        // middleware is responsible for refreshing the session cookie.
        try {
          for (const c of toSet) cookieStore.set(c.name, c.value, c.options);
        } catch {
          // Read-only context (e.g. RSC) — silently ignore.
        }
      },
    },
  });
}
