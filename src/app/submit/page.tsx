import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { SubmitForm } from "./submit-form";

export const dynamic = "force-dynamic";

async function getFormData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase env vars not configured");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [speakersRes, campaignsRes] = await Promise.all([
    sb.from("users").select("id, name, title, role").eq("org_id", DEMO_ORG_ID).in("role", ["speaker", "principal"]).order("name"),
    sb.from("campaigns").select("id, name").eq("org_id", DEMO_ORG_ID).order("name"),
  ]);
  if (speakersRes.error) throw new Error("Failed to load speakers: " + speakersRes.error.message);
  if (campaignsRes.error) throw new Error("Failed to load campaigns: " + campaignsRes.error.message);
  return {
    speakers: speakersRes.data || [],
    campaigns: campaignsRes.data || [],
  };
}

export default async function SubmitPage() {
  const { speakers, campaigns } = await getFormData();
  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">← Home</Link>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900 mt-2">Submit a draft</h1>
          <p className="text-sm text-neutral-500 mt-1">Drafts are checked against active rules before publication.</p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-8">
          <SubmitForm speakers={speakers} campaigns={campaigns} />
        </div>
      </div>
    </main>
  );
}
