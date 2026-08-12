"use client";

import React from "react";
import { TrendingUp, ArrowRight, DollarSign } from "lucide-react";
import { formatBOT } from "../../lib/utils";

interface AIPriceEstimatorProps {
  currentPriceBot: number;
  estimatedPriceBot: number;
  usdEquivalent: number;
}

export const AIPriceEstimator: React.FC<AIPriceEstimatorProps> = ({
  currentPriceBot,
  estimatedPriceBot,
  usdEquivalent,
}) => {
  const diffPercent = ((currentPriceBot - estimatedPriceBot) / estimatedPriceBot) * 100;
  const isBelowOrFair = diffPercent <= 5;

  return (
    <div className="bg-zinc-900/70 border border-white/10 rounded-2xl p-4 my-3 backdrop-blur-xl">
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
        <span className="flex items-center gap-1.5 font-medium text-cyan-400">
          <TrendingUp className="w-4 h-4" />
          Botrow AI Fair Market Price Model
        </span>
        <span className="text-zinc-400 font-mono">1 BOT = $4.50 USD</span>
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div>
          <div className="text-2xl font-black text-white tracking-tight">
            {formatBOT(currentPriceBot)}
          </div>
          <div className="text-xs text-zinc-400 font-mono mt-0.5">
            ≈ ${usdEquivalent.toLocaleString()} USD
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-zinc-400">AI Est: {formatBOT(estimatedPriceBot)}</div>
          <div className={`text-[11px] font-bold inline-flex items-center px-2 py-0.5 rounded-full mt-1 ${isBelowOrFair ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
            {diffPercent < 0 ? `${Math.abs(diffPercent).toFixed(1)}% Below Market` : diffPercent <= 5 ? "Fair Market Value" : `${diffPercent.toFixed(1)}% Above Premium`}
          </div>
        </div>
      </div>
    </div>
  );
};
