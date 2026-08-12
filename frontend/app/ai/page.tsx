"use client";

import React, { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Sparkles, Cpu, Loader2, Activity, ShieldCheck, Search } from "lucide-react";
import { getUser, getOrdersByBuyer, getOrdersBySeller, getProducts } from "@/lib/firestore";

export default function GlobalAiAgentPage() {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();

  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [userContext, setUserContext] = useState<any>(null);

  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Hello! I am Botrow AI, your personal marketplace concierge. I have securely synced your Botrow orders and the active marketplace listings. How can I help you today?" }
  ]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      setIsLoadingContext(true);
      Promise.all([
        getUser(address),
        getOrdersByBuyer(address),
        getOrdersBySeller(address),
        getProducts()
      ]).then(([profile, buyerOrders, sellerOrders, marketplaceProducts]) => {
        setUserContext({
          walletAddress: address,
          profile,
          buyerOrders,
          sellerOrders,
          marketplaceProducts
        });
      }).catch(console.error)
        .finally(() => setIsLoadingContext(false));
    } else {
      setUserContext(null);
    }
  }, [isConnected, address]);

  const askAiAssistant = async (question: string) => {
    if (!question || !question.trim()) return;
    if (!isConnected) {
      open({ view: "Connect" });
      return;
    }

    const newHistory = [...chatHistory, { role: "user" as const, text: question }];
    setChatHistory(newHistory);
    setCustomQuestion("");
    setIsAiThinking(true);

    try {
      const res = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: chatHistory, // Exclude the newly pushed user message, let the backend append it as currentTurn
          userContext: userContext
        }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setChatHistory([...newHistory, { role: "assistant" as const, text: data.reply }]);
      } else if (data?.error) {
        setChatHistory([...newHistory, { role: "assistant" as const, text: `AI Error: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}` }]);
      } else {
        setChatHistory([...newHistory, { role: "assistant" as const, text: "I'm having trouble processing that right now." }]);
      }
    } catch (err: any) {
      console.error("AI Agent Error:", err);
      setChatHistory([...newHistory, { role: "assistant" as const, text: `Connection Error: ${err?.message}` }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="border-b border-white/[0.07] pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-2">
              <Cpu className="w-4 h-4 animate-pulse" />
              <span>BOTROW AI AGENT — GLOBAL CONCIERGE</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="text-emerald-500 w-8 h-8" />
              Your Personal AI Assistant
            </h1>
            <p className="mt-2 text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Ask about your recent escrow orders, marketplace policies, or anything else. Botrow AI has securely synced your on-chain context to provide personalized assistance.
            </p>
          </div>
          {isLoadingContext && (
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900/80 text-emerald-500 px-3 py-1.5 rounded-full border border-emerald-500/30 text-xs font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Syncing Orders...
            </div>
          )}
          {!isLoadingContext && isConnected && userContext && (
            <div className="hidden sm:flex items-center gap-2 bg-zinc-900/80 text-zinc-300 px-3 py-1.5 rounded-full border border-white/10 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {userContext.buyerOrders?.length + userContext.sellerOrders?.length} Orders Synced
            </div>
          )}
        </div>

        {/* Chat Interface */}
        <div className="bg-[#0B0D13] border border-white/[0.05] rounded-xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
          
          {/* Chat History Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-700">
            {!isConnected ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <ShieldCheck className="w-12 h-12 text-zinc-600" />
                <div>
                  <h3 className="text-zinc-300 font-bold mb-1">Wallet Disconnected</h3>
                  <p className="text-zinc-500 text-sm max-w-sm">Connect your wallet so Botrow AI can securely retrieve your escrow orders and personalized data.</p>
                </div>
                <button 
                  onClick={() => open({ view: 'Connect' })}
                  className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-sm uppercase rounded transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm font-mono leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-zinc-800 text-zinc-200 shadow-lg' 
                      : 'bg-zinc-950/80 border border-emerald-500/30 text-emerald-50 shadow-inner'
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-2 text-emerald-500 border-b border-emerald-500/20 pb-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="font-bold tracking-wider text-[10px] uppercase">Botrow AI</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))
            )}
            
            {isAiThinking && (
              <div className="flex justify-start">
                <div className="bg-zinc-950/80 border border-emerald-500/30 p-4 rounded-2xl flex items-center gap-3">
                  <Activity className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-xs font-mono text-emerald-400/80 animate-pulse">Analyzing secure context...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 sm:p-6 bg-zinc-950/50 border-t border-white/[0.05]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                askAiAssistant(customQuestion);
              }}
              className="flex gap-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="e.g. Find my last order, or explain the refund policy..."
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  disabled={!isConnected || isAiThinking}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-sm font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!isConnected || isAiThinking || !customQuestion.trim()}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-sm uppercase rounded-xl disabled:opacity-50 flex items-center gap-2 shrink-0 transition-all"
              >
                {isAiThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
            <div className="mt-3 text-center">
              <span className="text-[10px] font-mono text-zinc-600">Botrow AI can make mistakes. Always verify smart contract transactions on BOT Chain Mainnet.</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
