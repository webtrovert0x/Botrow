"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, useBalance, useDisconnect } from "wagmi";
import { ShieldCheck, Terminal, Layers, PlusCircle, Wallet, ArrowRight, Menu, X, ChevronDown, Activity, Cpu, User, Sun, Moon } from "lucide-react";
import { clsx } from "clsx";
import { useTheme } from "@/context/ThemeContext";

export function Navbar() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { name: "Marketplace", href: "/marketplace", icon: Layers, label: "Explore" },
    { name: "Create Escrow", href: "/create", icon: PlusCircle, label: "List" },
    { name: "Dashboard", href: "/dashboard", icon: Activity, label: "Orders" },
    { name: "Profile & Delivery", href: "/profile", icon: User, label: "Settings" },
    { name: "AI Agent", href: "/ai", icon: Cpu, label: "Ask Botrow" },
  ];

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <header className="sticky top-0 z-50 w-full bg-[#090A0F]/90 backdrop-blur-md border-b border-white/[0.07] selection:bg-emerald-500 selection:text-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <NextLink href="/" className="flex items-center gap-2 group focus:outline-none">
            <div className="relative w-9 h-9 rounded bg-[#090A0F] border border-emerald-500/10 overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:border-emerald-500/30 transition-all duration-300">
              <img src="/botrow-logo.png" alt="Botrow AI Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <div className="flex flex-col ml-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight text-white text-sm">Botrow AI</span>
                <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded tracking-wider">
                  BOT CHAIN
                </span>
              </div>
            </div>
          </NextLink>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <NextLink
                  key={link.name}
                  href={link.href}
                  className={clsx(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium tracking-wide transition-all duration-200",
                    isActive
                      ? "bg-white/[0.08] text-white font-semibold shadow-sm border border-white/[0.05]"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
                  )}
                >
                  <Icon className={clsx("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                  {link.name}
                </NextLink>
              );
            })}
          </nav>

          {/* Web3 Wallet Section */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => open({ view: "Networks" })}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-white/10 text-[11px] font-mono text-zinc-300 hover:border-white/20 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>BOTCHAIN</span>
            </button>

            {!isConnected ? (
              <button
                onClick={() => open({ view: "Connect" })}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 font-mono tracking-tight shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-200"
              >
                <Wallet className="w-3.5 h-3.5" />
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 p-1 rounded-md text-xs font-mono">
                {balanceData && (
                  <span className="px-2 py-0.5 text-emerald-400 bg-emerald-500/10 rounded font-medium border border-emerald-500/20 text-[11px]">
                    {Number(balanceData.formatted).toFixed(2)} {balanceData.symbol}
                  </span>
                )}
                <button
                  onClick={() => open({ view: "Account" })}
                  className="px-2 py-0.5 text-zinc-200 hover:text-white transition-colors text-[11px]"
                >
                  {address ? formatAddress(address) : "Connected"}
                </button>
                <button
                  onClick={() => disconnect()}
                  title="Disconnect Wallet"
                  className="p-1 hover:bg-white/10 text-zinc-500 hover:text-red-400 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-1.5 rounded-md border border-white/10 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Theme Toggle + Mobile Menu Button */}
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 text-zinc-400 hover:text-emerald-400 rounded-md focus:outline-none transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-400 hover:text-white rounded-md focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-white/[0.07] bg-[#090A0F]/95 px-4 pt-3 pb-5 space-y-3 font-mono">
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <NextLink
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors",
                    isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-zinc-400 hover:bg-white/5"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.name}
                </NextLink>
              );
            })}
          </div>
          <div className="pt-2 border-t border-white/[0.05] flex flex-col gap-2">
            {!isConnected ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  open({ view: "Connect" });
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-emerald-500 text-black hover:bg-emerald-400"
              >
                <Wallet className="w-4 h-4" />
                CONNECT WALLET
              </button>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  open({ view: "Account" });
                }}
                className="w-full text-center px-3 py-2 rounded-md bg-zinc-900 border border-white/10 text-xs text-emerald-400 font-mono"
              >
                {address ? formatAddress(address) : "View Account"}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;
