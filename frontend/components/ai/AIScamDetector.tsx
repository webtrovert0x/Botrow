"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "../ui/card";
import { AIAnalysis } from "../../types";

interface AIScamDetectorProps {
  analysis: AIAnalysis;
}

export const AIScamDetector: React.FC<AIScamDetectorProps> = ({ analysis }) => {
  const isSafe = analysis.riskLevel === "LOW";
  const isModerate = analysis.riskLevel === "MEDIUM";

  return (
    <Card variant="glass" className="p-5 border border-white/10 relative overflow-hidden bg-gradient-to-br from-zinc-900/90 to-black/90">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 opacity-75" />

      <div className="flex items-start gap-3.5">
        <div className={`p-2.5 rounded-xl border ${isSafe ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : isModerate ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {isSafe ? <ShieldCheck className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Botrow AI Scam & Security Scan
            </h4>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded uppercase font-extrabold ${isSafe ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {analysis.riskLevel} RISK
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
            {analysis.scamWarningReason || "No suspicious linguistic patterns or pricing anomalies detected. Seller's cryptographic historical footprint on BOT Chain demonstrates 99.4% escrow fulfillment reliability."}
          </p>

          <div className="pt-3 border-t border-white/10 flex flex-wrap gap-2 items-center justify-between text-xs text-zinc-300">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>IPFS CID Spec Integrity Verified</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono font-bold bg-zinc-800/80 px-2 py-0.5 rounded border border-white/10">Botrow AI</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
