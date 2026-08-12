"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Cpu, Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#07080C] text-zinc-400 text-xs font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left info */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded bg-[#090A0F] border border-emerald-500/10 overflow-hidden shadow-[0_0_10px_rgba(16,185,129,0.1)]">
              <img src="/botrow-logo.png" alt="Botrow AI Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div>
              <div className="text-white font-semibold font-sans">Botrow AI</div>
              <div className="text-[11px] text-zinc-500">Secure Escrow & Protocol</div>
            </div>
          </div>

          {/* Center stats */}
          <div className="flex items-center gap-6 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>RPC: rpc.botchain.ai</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>SECURITY: OpenZeppelin v5.7.0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>AI: Botrow AI Underwriting</span>
            </div>
          </div>

          {/* Right link */}
          <div className="text-zinc-500 text-[11px]">
            © 2026 Botrow. Built with Reown AppKit & Wagmi.
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
