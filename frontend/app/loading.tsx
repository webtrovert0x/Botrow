import React from "react";
import { Loader2, Hexagon } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#090A0F] flex flex-col items-center justify-center p-4">
      <div className="relative">
        <Hexagon className="w-16 h-16 text-emerald-500/20 absolute -inset-2 animate-pulse" strokeWidth={1} />
        <Loader2 className="w-12 h-12 text-emerald-400 animate-spin relative z-10" />
      </div>
      <h2 className="mt-6 text-xl font-bold font-mono text-white tracking-widest uppercase flex items-center gap-2">
        Botrow AI <span className="text-emerald-500 animate-pulse">_</span>
      </h2>
      <p className="mt-2 text-xs font-mono text-zinc-500 uppercase tracking-widest">
        Initializing Secure Core
      </p>
    </div>
  );
}
