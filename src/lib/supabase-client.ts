/**
 * Browser-side Supabase client factory.
 *
 * Built on `@supabase/ssr`. Same shape as the spec calls for:
 * `createBrowserClient()` returns a singleton-ish client suitable for
 * client components. Sessions are persisted in cookies so the
 * middleware sees them on the next navigation.
 */
import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (or _PUBLISHABLE_KEY).",
    );
  }
  return createSsrBrowserClient(url, key);
}
