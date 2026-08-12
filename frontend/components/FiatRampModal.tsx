"use client";

import React, { useState, useEffect } from "react";
import { X, ArrowRightLeft, CreditCard, Landmark, CheckCircle2, Loader2, DollarSign, Wallet, ExternalLink } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { usePaystackPayment } from "react-paystack";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import toast from "react-hot-toast";


interface FiatRampModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | undefined;
}

export default function FiatRampModal({ isOpen, onClose, walletAddress }: FiatRampModalProps) {
  const { convertUsdToBot, formatUsd, formatNgn, usdToNgnRate, isLoading: isRatesLoading } = useCurrency();
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [fiatAmount, setFiatAmount] = useState<string>("100");
  const [currency, setCurrency] = useState<"USD" | "NGN">("USD");
  const [step, setStep] = useState<"input" | "processing" | "success">("input");

  // Wagmi hooks for Sell functionality
  const { sendTransaction, data: hash, isPending: isTxPending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setFiatAmount("100");
    }
  }, [isOpen]);

  // Handle blockchain confirmation for selling
  useEffect(() => {
    if (isConfirmed && mode === "sell" && step === "processing") {
      setStep("success");
      toast.success("BOT Received! Your fiat wire transfer has been initiated.");
    }
  }, [isConfirmed, mode, step]);

  if (!isOpen) return null;

  // Derived calculations
  const numFiat = parseFloat(fiatAmount) || 0;
  
  // Calculate equivalent USD if they selected NGN
  const equivalentUsd = currency === "USD" ? numFiat : (usdToNgnRate > 0 ? numFiat / usdToNgnRate : 0);
  
  // Calculate final BOT amount based on USD equivalent
  const grossBotAmount = convertUsdToBot(equivalentUsd);
  const botAmount = mode === "buy" ? grossBotAmount * 0.98 : grossBotAmount; // Apply 2% fee on Buy

  // Paystack Configuration
  const paystackAmountNGN = currency === "NGN" ? numFiat : numFiat * usdToNgnRate;
  const paystackAmountKobo = Math.round(paystackAmountNGN * 100);

  const config = {
    reference: (new Date()).getTime().toString(),
    email: "botrow_user@example.com", // Normally tied to auth, hardcoded for hackathon
    amount: paystackAmountKobo,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "",
  };

  const initializePayment = usePaystackPayment(config);

  const handlePaystackSuccess = async (reference: any) => {
    setStep("processing");
    const ref = reference.reference;
    console.log("[FiatRamp] Paystack success. Submitting reference:", ref, "Wallet:", walletAddress);
    try {
      const res = await fetch("/api/faucet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reference: ref, 
          walletAddress
        })
      });
      const data = await res.json();
      console.log("[FiatRamp] Faucet response:", data);
      if (data.success) {
        setStep("success");
        toast.success(`Payment Verified! ${parseFloat(data.botAmount).toFixed(4)} BOT tokens have been disbursed.`);
      } else {
        // Show the ACTUAL server error so we know what failed
        const msg = data.error || "Verification failed. Please contact support with your Paystack reference.";
        toast.error(`Error: ${msg}\n\nYour Paystack reference is: ${ref}\nPlease save this for support.`);
        setStep("input");
      }
    } catch (err) {
      console.error("[FiatRamp] Network error:", err);
      toast.error(`Network error. Your Paystack reference is: ${ref}\nPlease contact support.`);
      setStep("input");
    }
  };

  const handlePaystackClose = () => {
    console.log("Paystack closed");
  };

  const handleSimulatedCheckout = async () => {
    if (numFiat <= 0) return;
    
    if (mode === "buy") {
      // Trigger actual Paystack Checkout
      if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
        toast.error("Missing NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local!");
        return;
      }
      
      setStep("processing");
      try {
        const res = await fetch(`/api/faucet/check-liquidity?botAmount=${botAmount}`);
        let data: any = {};
        try {
          data = await res.json();
        } catch (e) {
          throw new Error("Server returned an invalid response (likely a timeout).");
        }
        
        if (!data.success || !data.available) {
          toast.error(`Cannot process payment: ${data.reason || data.error || "Treasury empty."}`);
          setStep("input");
          return;
        }
        
        // Liquidity is good, open Paystack
        setStep("input"); // Reset step so Paystack widget can open cleanly over it
        initializePayment({
          onSuccess: (ref: any) => handlePaystackSuccess(ref),
          onClose: handlePaystackClose
        });
      } catch (err: any) {
        console.error("Liquidity check failed:", err);
        toast.error(`Network error while checking Treasury liquidity: ${err?.message || "Unknown error"}`);
        setStep("input");
      }
    } else {
      // Real Web3 Off-ramp (Sell BOT to Treasury)
      const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "";
      
      try {
        sendTransaction({
          to: treasuryAddress as `0x${string}`,
          value: parseEther(botAmount.toString()),
        });
        setStep("processing");
      } catch (err) {
        console.error("Failed to initiate Web3 transaction:", err);
        toast.error("Failed to initiate transaction.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={step !== "processing" ? onClose : undefined}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#0B0D13] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wide">
                Botrow Fiat Gateway
              </h3>
              <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Powered by Paystack
              </p>
            </div>
          </div>
          {step !== "processing" && (
            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="p-6">
          {step === "input" && (
            <div className="space-y-6">
              {/* Mode Toggle */}
              <div className="flex p-1 bg-zinc-900 rounded-lg border border-white/[0.05]">
                <button
                  onClick={() => setMode("buy")}
                  className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
                    mode === "buy" ? "bg-emerald-500 text-black shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Buy BOT
                </button>
                <button
                  onClick={() => setMode("sell")}
                  className={`flex-1 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-md transition-all ${
                    mode === "sell" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Sell BOT
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-semibold uppercase text-zinc-400">
                  {mode === "buy" ? "You Pay" : "You Receive"} (Fiat)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-4 text-zinc-400 font-bold">
                    {currency === "USD" ? "$" : "₦"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    className="w-full pl-8 pr-24 py-4 bg-zinc-950 border border-zinc-800 focus:border-emerald-500 rounded-xl text-2xl font-bold font-mono text-white outline-none transition-colors tabular-nums"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as "USD" | "NGN")}
                      className="bg-zinc-800 border-none text-white text-xs font-bold font-mono rounded-lg px-3 py-2 cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/50"
                    >
                      <option value="USD">USD</option>
                      <option value="NGN">NGN</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conversion Result */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                <label className="text-[10px] font-mono font-bold uppercase text-emerald-500/70 block mb-1">
                  {mode === "buy" ? "You Receive (Crypto)" : "You Pay (Crypto)"}
                </label>
                <div className="text-3xl font-bold font-mono text-emerald-400 truncate tracking-tight">
                  {isRatesLoading ? (
                    <span className="text-sm animate-pulse text-emerald-400/50">Fetching live rates...</span>
                  ) : (
                    <>
                      {botAmount.toFixed(4)} <span className="text-base text-emerald-400/70">BOT</span>
                    </>
                  )}
                </div>
                <div className="mt-1 text-[10px] font-mono text-zinc-500 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>1 BOT ≈ {currency === "USD" ? formatUsd(equivalentUsd / (grossBotAmount || 1)) : formatNgn(equivalentUsd / (grossBotAmount || 1))}</span>
                    <span>Coinstore Rate</span>
                  </div>
                  {mode === "buy" && grossBotAmount > 0 && (
                    <div className="flex items-center justify-between text-amber-500/80">
                      <span>Gross: {grossBotAmount.toFixed(4)} BOT</span>
                      <span>Fee: {(grossBotAmount * 0.02).toFixed(4)} BOT (2%)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method Preview */}
              {mode === "buy" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-semibold uppercase text-zinc-500">Payment Method</label>
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-zinc-800 flex items-center justify-center">
                      {currency === "USD" ? <CreditCard className="w-4 h-4 text-zinc-400" /> : <Landmark className="w-4 h-4 text-zinc-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono font-bold text-zinc-200">
                        {currency === "USD" ? "Credit / Debit Card" : "Local Bank Transfer"}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-500">
                        {currency === "USD" ? "Instant USD to NGN Conversion" : "Instant NGN Settlement"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleSimulatedCheckout}
                disabled={isRatesLoading || numFiat <= 0}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {mode === "buy" ? "Pay with Paystack" : "Cash Out to Fiat"}
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "processing" && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-zinc-800 animate-pulse" />
                <Loader2 className="w-16 h-16 text-emerald-500 animate-spin absolute inset-0" />
              </div>
              <div>
                <h4 className="text-lg font-bold font-mono text-white mb-2 uppercase">
                  {mode === "buy" ? "Verifying Payment & Disbursing BOT..." : (isTxPending ? "Approve in Wallet..." : "Confirming on BOT Chain...")}
                </h4>
                <p className="text-xs font-mono text-zinc-400 max-w-[250px] mx-auto">
                  {mode === "buy" 
                    ? "Please wait while we verify your Paystack payment and securely transfer BOT tokens to your wallet on the BOT Chain." 
                    : "Please sign the transaction in your connected Web3 wallet. Once confirmed on the blockchain, your fiat transfer will be initiated."}
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center border-4 border-emerald-500/30">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h4 className="text-xl font-bold font-mono text-white mb-2 uppercase tracking-wide">
                  Transaction Complete
                </h4>
                <div className="p-4 bg-zinc-900 border border-white/10 rounded-lg inline-block text-left mb-6 min-w-[260px]">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">
                    {mode === "buy" ? "Tokens Delivered to:" : "Fiat Sent to Bank:"}
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold break-all flex items-center gap-2">
                    {mode === "buy" ? (
                      <>
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}` : "Connected Wallet"}
                      </>
                    ) : (
                      <>
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                        Linked Bank Account
                      </>
                    )}
                  </div>
                  <div className="h-px w-full bg-white/10 my-3" />
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-zinc-400 uppercase text-[10px]">Amount {mode === "buy" ? "Bought" : "Sold"}</span>
                    <span className="text-white font-bold">{botAmount.toFixed(4)} BOT</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
