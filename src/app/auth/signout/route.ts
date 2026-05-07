/**
 * Sign out endpoint. POST → terminates the Supabase session and
 * redirects to /. Server action style so the user menu can post a
 * form here without any client JS.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  const url = new URL("/", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
