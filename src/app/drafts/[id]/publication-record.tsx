"use client";

import { useState } from "react";
import { recordPublicationAction } from "./actions";

const PLATFORMS = [
  { value: "linkedin",      label: "LinkedIn" },
  { value: "twitter",       label: "X / Twitter" },
  { value: "blog",          label: "Blog / Website" },
  { value: "press_release", label: "Press Release" },
  { value: "email",         label: "Email" },
  { value: "earnings_call", label: "Earnings Call" },
  { value: "other",         label: "Other" },
] as const;

type Props = {
  draftId: string;
  existingPlatform?: string | null;
  existingUrl?: string | null;
  existingPublishedAt?: string | null;
};

function platformLabel(value: string): string {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

export function PublicationRecord({
  draftId,
  existingPlatform,
  existingUrl,
  existingPublishedAt,
}: Props) {
  const [platform, setPlatform] = useState(existingPlatform ?? "");
  const [url, setUrl] = useState(existingUrl ?? "");
  // datetime-local needs YYYY-MM-DDTHH:mm. Slice an ISO string to that.
  const [publishedAt, setPublishedAt] = useState(
    existingPublishedAt
      ? new Date(existingPublishedAt).toISOString().slice(0, 16)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!existingPlatform);
  const [savedPlatform, setSavedPlatform] = useState(existingPlatform ?? null);
  const [savedUrl, setSavedUrl] = useState(existingUrl ?? null);
  const [savedAt, setSavedAt] = useState(existingPublishedAt ?? null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!platform) return;
    setError(null);
    setSaving(true);
    const result = await recordPublicationAction({
      draftId,
      platform,
      url: url || null,
      publishedAt: publishedAt
        ? new Date(publishedAt).toISOString()
        : new Date().toISOString(),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSavedPlatform(platform);
    setSavedUrl(url || null);
    setSavedAt(
      publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
    );
    setSaved(true);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B]">
          Publication record
        </div>
        {saved && (
          <span className="font-mono text-[10px] text-[#166534] flex items-center gap-1">
            ✓ Recorded
          </span>
        )}
      </div>

      {saved && savedPlatform ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs bg-[#F1F5F9] text-[#374151] px-2 py-1 rounded-sm border border-[#E2E8F0]">
              {platformLabel(savedPlatform)}
            </span>
            {savedUrl && (
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[#1A56DB] hover:text-[#1447C0] truncate max-w-xs"
              >
                {savedUrl} ↗
              </a>
            )}
          </div>
          {savedAt && (
            <div className="font-mono text-[10px] text-[#94A3B8]">
              Published:{" "}
              {new Date(savedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setSaved(false)}
            className="font-mono text-[10px] text-[#64748B] hover:text-[#0F172A] transition-colors mt-1"
          >
            Update →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-[#374151] leading-relaxed">
            Where was this approved draft published?
          </div>

          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
            aria-label="Platform"
          >
            <option value="">Select platform...</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (optional)"
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
            aria-label="Publication URL"
          />

          <input
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] font-mono"
            aria-label="Publication time"
          />

          {error && (
            <div className="font-mono text-[10px] text-[#B91C1C]">{error}</div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!platform || saving}
            className="w-full bg-[#0F172A] text-white font-mono text-xs font-medium py-2.5 rounded-sm hover:bg-[#1E293B] disabled:opacity-40 transition-colors"
          >
            {saving ? "Recording..." : "Record publication →"}
          </button>
        </div>
      )}
    </div>
  );
}
