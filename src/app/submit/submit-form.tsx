"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitDraftAction } from "./actions";

type Speaker = { id: string; name: string; title: string | null; role: string };
type Campaign = { id: string; name: string };
type Props = { speakers: Speaker[]; campaigns: Campaign[] };

export function SubmitForm({ speakers, campaigns }: Props) {
 const router = useRouter();
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [speakerId, setSpeakerId] = useState(speakers[0]?.id || "");
 const [channel, setChannel] = useState("linkedin");
 const [sourceOrigin, setSourceOrigin] = useState("human");
 const [campaignId, setCampaignId] = useState("");
 const [draftText, setDraftText] = useState("");

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 setError(null);
 if (!draftText.trim()) { setError("Draft text cannot be empty."); return; }
 if (!speakerId) { setError("Please select a speaker."); return; }
 setSubmitting(true);
 try {
 const result = await submitDraftAction({
 speakerId, channel, sourceOrigin,
 campaignId: campaignId || null,
 draftText: draftText.trim(),
 });
 if (result.error) { setError(result.error); setSubmitting(false); return; }
 router.push(`/drafts/${result.draftId}`);
 } catch (err) {
 const message = err instanceof Error ? err.message : "Unknown error";
 setError(message);
 setSubmitting(false);
 }
 }

 return (
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <label htmlFor="speaker" className="block text-sm font-medium text-[#1C1C1A] mb-2">Speaker</label>
 <select id="speaker" value={speakerId} onChange={(e) => setSpeakerId(e.target.value)} className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]">
 {speakers.map((s) => (<option key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ""}</option>))}
 </select>
 </div>
 <div>
 <label htmlFor="channel" className="block text-sm font-medium text-[#1C1C1A] mb-2">Channel</label>
 <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]">
 <option value="linkedin">LinkedIn</option>
 <option value="twitter">Twitter / X</option>
 <option value="press_release">Press release</option>
 <option value="blog">Blog</option>
 <option value="interview">Interview</option>
 <option value="email">Email</option>
 <option value="other">Other</option>
 </select>
 </div>
 <div>
 <label htmlFor="source" className="block text-sm font-medium text-[#1C1C1A] mb-2">Source</label>
 <select id="source" value={sourceOrigin} onChange={(e) => setSourceOrigin(e.target.value)} className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]">
 <option value="human">Written by human</option>
 <option value="ai_assisted">AI-assisted</option>
 <option value="ai_generated">AI-generated</option>
 </select>
 <p className="text-xs text-[#6E6E68] mt-1">Required by EU AI Act Article 50.</p>
 </div>
 <div>
 <label htmlFor="campaign" className="block text-sm font-medium text-[#1C1C1A] mb-2">Campaign (optional)</label>
 <select id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1C1A]">
 <option value="">None</option>
 {campaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
 </select>
 </div>
 <div>
 <label htmlFor="draft" className="block text-sm font-medium text-[#1C1C1A] mb-2">Draft</label>
 <textarea id="draft" value={draftText} onChange={(e) => setDraftText(e.target.value)} rows={8} placeholder="Write or paste your draft here..." className="w-full px-3 py-2 border border-[#E2E1DC] rounded-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#1C1C1A] resize-y" />
 <p className="text-xs text-[#6E6E68] mt-1">{draftText.length} characters</p>
 </div>
 {error && (<div className="px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-sm text-sm text-[#B91C1C]">{error}</div>)}
 <div className="flex justify-end gap-3 pt-2">
 <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#1C1C1A] text-white text-sm font-medium rounded-sm hover:bg-[#333331] transition disabled:opacity-50 disabled:cursor-not-allowed">
 {submitting ? "Submitting..." : "Submit for review"}
 </button>
 </div>
 </form>
 );
}
