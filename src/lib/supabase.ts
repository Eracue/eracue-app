/**
 * Convenience re-exports for the Supabase client factories. Import from
 * here when you don't care which surface (server vs browser) you're on
 * — pick the named export that matches your context.
 *
 * Also exposes `getSupabaseAdmin()` for server actions that need to
 * bypass RLS (used for cross-org work like the demo seeds and the
 * audit-trail inserts in submitDraftAction).
 */
import { createClient } from "@supabase/supabase-js";

export { createServerClient } from "./supabase-server";
export { createBrowserClient } from "./supabase-client";

/**
 * Service-role client. Bypasses Row Level Security — only use this from
 * server actions / route handlers, never from anything that reaches the
 * browser. The `SUPABASE_SECRET_KEY` env var must be set.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
