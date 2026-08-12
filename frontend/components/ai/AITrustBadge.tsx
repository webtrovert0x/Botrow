"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { ScamRiskLevel } from "../../types";

interface AITrustBadgeProps {
  score: number;
  riskLevel: ScamRiskLevel;
  showDetails?: boolean;
}

export const AITrustBadge: React.FC<AITrustBadgeProps> = ({ score, riskLevel, showDetails = false }) => {
  const getBadgeVariant = () => {
    if (score >= 90) return "emerald";
    if (score >= 75) return "cyan";
    if (score >= 60) return "amber";
    return "rose";
  };

  const getIcon = () => {
    if (score >= 90) return <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />;
    if (score >= 75) return <Sparkles className="w-4 h-4 text-cyan-400" />;
    if (score >= 60) return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <ShieldAlert className="w-4 h-4 text-rose-400 animate-bounce" />;
  };

  return (
    <div className="flex flex-col gap-1">
      <Badge variant={getBadgeVariant()} className="py-1 px-3 flex items-center gap-2 text-xs font-semibold shadow-md">
        {getIcon()}
        <span>Botrow AI Trust Score: <strong>{score}%</strong></span>
      </Badge>
      {showDetails && (
        <span className="text-[11px] text-zinc-400 pl-1">
          Risk Tier: <span className="font-mono text-white font-medium">{riskLevel} RISK</span>
        </span>
      )}
    </div>
  );
};
