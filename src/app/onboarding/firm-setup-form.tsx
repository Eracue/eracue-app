"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setupFirmAction, type FirmType } from "./actions";

const FIRM_TYPES: Array<{
  value: FirmType;
  label: string;
  blurb: string;
  defaultRegs: string[];
}> = [
  {
    value: "broker_dealer",
    label: "Broker-Dealer",
    blurb: "FINRA Rule 2210/3110 supervision",
    defaultRegs: ["FINRA 2210/3110"],
  },
  {
    value: "rIA",
    label: "Registered Investment Adviser",
    blurb: "SEC Marketing Rule + Rule 204-2",
    defaultRegs: ["SEC Marketing Rule"],
  },
  {
    value: "public_company",
    label: "Public Company",
    blurb: "Reg FD + earnings communications",
    defaultRegs: ["Reg FD"],
  },
  {
    value: "investment_bank",
    label: "Investment Bank / PE / HF",
    blurb: "Deal-specific quiet periods",
    defaultRegs: ["FINRA 2210/3110"],
  },
  {
    value: "non_regulated",
    label: "Non-regulated",
    blurb: "Brand and message governance",
    defaultRegs: ["Brand"],
  },
];

const REG_OPTIONS = [
  { value: "FINRA 2210/3110", label: "FINRA Rule 2210/3110" },
  { value: "SEC Marketing Rule", label: "SEC Marketing Rule" },
  { value: "Reg FD", label: "Reg FD / Fair Disclosure" },
  { value: "EU AI Act 50", label: "EU AI Act Article 50" },
  { value: "Brand", label: "Brand/message governance only" },
];

export function FirmSetupForm() {
  const router = useRouter();
  const [firmName, setFirmName] = useState("");
  const [firmType, setFirmType] = useState<FirmType>("broker_dealer");
  const [regs, setRegs] = useState<string[]>(["FINRA 2210/3110"]);
  const [userTitle, setUserTitle] = useState("Chief Compliance Officer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function pickFirmType(value: FirmType) {
    setFirmType(value);
    // Auto-tick the regs that match this firm type. User can still edit.
    const ft = FIRM_TYPES.find((f) => f.value === value);
    if (ft) setRegs(ft.defaultRegs);
  }

  function toggleReg(value: string) {
    setRegs((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
  }

  async function handleSubmit() {
    setError("");
    if (!firmName.trim()) {
      setError("Firm name required.");
      return;
    }
    if (!userTitle.trim()) {
      setError("Your role title is required.");
      return;
    }
    setLoading(true);
    const result = await setupFirmAction({
      firmName,
      firmType,
      regulatoryFramework: regs,
      userTitle,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    router.push("/onboarding/rules");
    router.refresh();
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-sm p-6">
      {error && (
        <div
          className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-sm rounded-sm px-3 py-2 mb-4"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Firm name */}
      <div className="mb-5">
        <label
          htmlFor="firm-name"
          className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
        >
          Firm name
        </label>
        <input
          id="firm-name"
          type="text"
          value={firmName}
          onChange={(e) => setFirmName(e.target.value)}
          placeholder="Acme Capital Partners"
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB] placeholder:text-[#94A3B8]"
        />
      </div>

      {/* Firm type */}
      <div className="mb-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-2">
          Firm type
        </div>
        <div className="space-y-1.5">
          {FIRM_TYPES.map((opt) => {
            const selected = firmType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pickFirmType(opt.value)}
                className={`w-full text-left px-3 py-2.5 rounded-sm border text-sm transition-colors cursor-pointer ${
                  selected
                    ? "bg-[#EFF8FF] border-[#BAE6FD]"
                    : "bg-white border-[#E2E8F0] hover:bg-[#F8F9FB]"
                }`}
              >
                <div className="font-medium text-[#0F172A] text-sm">{opt.label}</div>
                <div className="font-mono text-[10px] text-[#64748B] mt-0.5">{opt.blurb}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Regulatory framework */}
      <div className="mb-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] mb-1">
          Primary regulatory concern
        </div>
        <div className="font-mono text-[10px] text-[#94A3B8] mb-2">
          Auto-selected from firm type — change as needed
        </div>
        <div className="space-y-1">
          {REG_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer text-sm text-[#0F172A]"
            >
              <input
                type="checkbox"
                checked={regs.includes(opt.value)}
                onChange={() => toggleReg(opt.value)}
                className="w-4 h-4 accent-[#1A56DB] cursor-pointer"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {/* Role */}
      <div className="mb-6">
        <label
          htmlFor="user-title"
          className="font-mono text-[10px] uppercase tracking-widest text-[#64748B] block mb-1.5"
        >
          Your role at the firm
        </label>
        <input
          id="user-title"
          type="text"
          value={userTitle}
          onChange={(e) => setUserTitle(e.target.value)}
          className="w-full border border-[#E2E8F0] rounded-sm px-3 py-2.5 text-sm text-[#0F172A] bg-[#F8F9FB] focus:outline-none focus:ring-1 focus:ring-[#1A56DB]"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !firmName.trim() || !userTitle.trim()}
        className="w-full bg-[#1A56DB] text-white font-mono text-sm font-medium py-2.5 rounded-sm hover:bg-[#1447C0] disabled:opacity-50 transition-colors"
      >
        {loading ? "Setting up..." : "Continue to rules →"}
      </button>
    </div>
  );
}
