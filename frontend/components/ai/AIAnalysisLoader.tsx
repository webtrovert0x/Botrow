"use client";

import React from "react";
import { Cpu, CheckCircle2, ShieldAlert } from "lucide-react";

export default function AIAnalysisLoader({ status }: { status: "analyzing" | "trusted" | "suspicious" }) {
  if (status === "analyzing") {
    return (
      <div className="flex items-center gap-3 p-3 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-emerald-400">
        <Cpu className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
        <div>
          <span className="font-bold text-white uppercase tracking-wider block">Neural Underwriting In Progress</span>
          <span className="text-zinc-400 text-[11px]">Evaluating on-chain proofs and seller historical latency...</span>
        </div>
      </div>
    );
  }

  if (status === "trusted") {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-md text-xs font-mono text-emerald-400">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        <div>
          <span className="font-bold uppercase tracking-wider block text-white">AI Underwriting Pass: Trusted Asset</span>
          <span className="text-zinc-300 text-[11px]">No sybil vectors or anomalous price volatility detected.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-500/30 rounded-md text-xs font-mono text-red-400">
      <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
      <div>
        <span className="font-bold uppercase tracking-wider block text-white">AI Warning: Anomalous Listing</span>
        <span className="text-zinc-300 text-[11px]">Proceed with caution. Arbitrator intervention insurance recommended.</span>
      </div>
    </div>
  );
}
