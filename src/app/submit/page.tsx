import { createClient } from "@supabase/supabase-js";
import { DEMO_ORG_ID } from "@/lib/demo-config";
import { SubmitForm } from "./submit-form";
import { SiteHeader } from "@/app/site-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#F7F6F3]">
        {/* Page header */}
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
          <div className="mb-1">
            <span className="font-mono text-xs uppercase tracking-widest text-[#6E6E68]">
              PRE-PUBLICATION CHECK
            </span>
          </div>
          <h1
            style={{ fontFamily: "var(--font-newsreader)" }}
            className="text-3xl font-light text-[#1C1C1A] mb-1"
          >
            Check this draft before it goes live.
          </h1>
          <p className="text-sm text-[#6E6E68] max-w-xl">
            Five checks run instantly. Rule violations surface in under one
            second. Every submission generates an immutable record.
          </p>
        </div>
        <SubmitForm speakers={speakers} campaigns={campaigns} />
      </main>
    </>
  );
}
