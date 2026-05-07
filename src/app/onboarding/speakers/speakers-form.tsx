"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendInvitationsAction, type InviteRow } from "../actions";

const EMPTY_INVITE: InviteRow = {
  email: "",
  display_name: "",
  title: "",
  role: "speaker",
};

export function SpeakersForm() {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteRow[]>([{ ...EMPTY_INVITE }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateInvite(i: number, patch: Partial<InviteRow>) {
    setInvites((prev) => prev.map((inv, idx) => (idx === i ? { ...inv, ...patch } : inv)));
  }

  function addRow() {
    setInvites((prev) => [...prev, { ...EMPTY_INVITE }]);
  }

  function removeRow(i: number) {
    setInvites((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function handleSubmit(skip = false) {
    setError("");
    setLoading(true);
    const payload = skip ? [] : invites;
    const result = await sendInvitationsAction(payload);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/onboarding/test");
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
      <div className="mb-2">
        <div
          style={{ fontFamily: "var(--font-newsreader)" }}
          className="font-light text-xl text-[#0F172A]"
        >
          Who needs to submit drafts?
        </div>
        <div className="text-sm text-[#374151] mt-1 leading-relaxed">
          Add your executives, advisers, or representatives. They&apos;ll
          receive an invitation to join ERA CUE — you can also add more
          people later from the dashboard.
        </div>
      </div>

      {error && (
        <div
          className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-sm px-3 py-2 my-4"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {invites.map((invite, i) => (
          <div
            key={i}
            className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start border-b border-[#F1F5F9] pb-3 last:border-b-0 last:pb-0"
          >
            <input
              type="text"
              value={invite.display_name}
              onChange={(e) => updateInvite(i, { display_name: e.target.value })}
              placeholder="Name"
              className="md:col-span-3 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
            <input
              type="text"
              value={invite.title}
              onChange={(e) => updateInvite(i, { title: e.target.value })}
              placeholder="Title (e.g. CEO)"
              className="md:col-span-3 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
            <input
              type="email"
              value={invite.email}
              onChange={(e) => updateInvite(i, { email: e.target.value })}
              placeholder="email@firm.com"
              className="md:col-span-3 border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            />
            <select
              value={invite.role}
              onChange={(e) =>
                updateInvite(i, { role: e.target.value as InviteRow["role"] })
              }
              className="md:col-span-2 border border-[#E2E8F0] rounded-sm px-2 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            >
              <option value="speaker">Speaker</option>
              <option value="principal">Principal</option>
            </select>
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={invites.length === 1}
              aria-label="Remove row"
              className="md:col-span-1 font-mono text-xs text-[#64748B] hover:text-[#B91C1C] transition-colors disabled:opacity-30 px-2 py-2 cursor-pointer text-left md:text-center"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] transition-colors mt-3 cursor-pointer"
      >
        + Add another person
      </button>

      <div className="flex items-center justify-between mt-6 pt-5 border-t border-[#E2E8F0]">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className="font-mono text-xs text-[#64748B] hover:text-[#0F172A] transition-colors"
        >
          Skip for now
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="bg-[#0F172A] text-white font-mono text-sm font-medium px-5 py-2.5 rounded-sm hover:bg-[#1E293B] disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending..." : "Send invitations →"}
        </button>
      </div>
    </div>
  );
}
