import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secretKey = process.env.SUPABASE_SECRET_KEY!;

if (!secretKey || secretKey === "PLACEHOLDER_USER_WILL_FILL") {
  throw new Error("SUPABASE_SECRET_KEY not configured. Edit .env.local.");
}

export const supabaseAdmin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
