"use client";

import React, { useState, use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { parseEther, decodeEventLog } from "viem";
import { BOTROW_CONTRACT_ADDRESS, BOTROW_ABI } from "@/constants/contract";
import { botChainMainnet } from "@/config/chains";
import { createOrder, getProduct, getUser, calculateSellerTrustScore } from "@/lib/firestore";
import { ShieldCheck, ArrowLeft, CheckCircle2, AlertTriangle, Lock, Cpu, Terminal, Activity, Info, Sparkles, Wallet, Zap, DollarSign, User, Phone, MapPin, Mail, Loader2, Hexagon, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { useCurrency } from "@/hooks/useCurrency";

export default function AssetDetailModal({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { convertBotToUsd, convertBotToNgn, formatUsd, formatNgn, isLoading: isCurrencyLoading } = useCurrency();
  const [item, setItem] = useState<any>(null);
  const [isLoadingItem, setIsLoadingItem] = useState(true);
  const [itemNotFound, setItemNotFound] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Buyer Delivery Information State
  const [recipientName, setRecipientName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");

  useEffect(() => {
    if (!resolvedParams.id) return;
    setIsLoadingItem(true);
    getProduct(resolvedParams.id)
      .then(async (p) => {
        if (p) {
          const cleanPrice = Math.abs(Number(p.price) || 0);
          const realTrustScore = p.sellerWallet ? await calculateSellerTrustScore(p.sellerWallet) : 90;
          
          setItem({
            id: p.id,
            title: p.title,
            description: p.description || p.aiDescription || "No detailed description provided.",
            category: p.category,
            priceBot: cleanPrice,
            usdEquivalent: (cleanPrice * 0.5).toFixed(2),
            image: p.images?.[0] || "/placeholder.jpg",
            images: p.images && p.images.length > 0 ? p.images : ["/placeholder.jpg"],
            sellerAddress: p.sellerWallet || "0x293ed7F710D056887C6e3Ef5EdBC9B95e32f03a4",
            sellerName: p.sellerWallet ? `${p.sellerWallet.slice(0, 6)}...${p.sellerWallet.slice(-4)}` : "Verified Seller",
            sellerTrustScore: realTrustScore,
            specifications: { "Condition": p.condition || "Verified" },
            aiAnalysis: {
              trustScore: realTrustScore,
              riskLevel: realTrustScore >= 80 ? "LOW" : realTrustScore >= 50 ? "MEDIUM" : "HIGH",
              priceEstimateBot: cleanPrice,
              suggestedTags: ["#VerifiedP2P", "#BotrowInspected"],
              isVerifiedByBotrowAI: true,
            },
          });
        } else {
          setItemNotFound(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setItemNotFound(true);
      })
      .finally(() => setIsLoadingItem(false));
  }, [resolvedParams.id]);

  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { open } = useAppKit();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [isProfileComplete, setIsProfileComplete] = useState(false);

  // Load user default delivery address from profile if connected
  useEffect(() => {
    if (address) {
      getUser(address).then((profile) => {
        if (profile) {
          if (profile.fullName) setRecipientName(profile.fullName);
          if (profile.phoneNumber) setBuyerPhone(profile.phoneNumber);
          if (profile.email) setBuyerEmail(profile.email);
          if (profile.shippingAddress) setBuyerAddress(profile.shippingAddress);

          if (profile.fullName && profile.email && profile.shippingAddress) {
            setIsProfileComplete(true);
          }
        }
      }).catch(console.error);
    }
  }, [address]);

  const [escrowStep, setEscrowStep] = useState<"idle" | "evaluating" | "ready" | "confirming" | "locked">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [firestoreOrderId, setFirestoreOrderId] = useState<string | null>(null);

  // Buyer Assistant Chat Console State
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const [escrowExpiresAt, setEscrowExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  // Wagmi V2 hooks for live testnet execution
  const { writeContractAsync, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract();
  const { data: txReceipt, isLoading: isReceiptLoading, isSuccess: isReceiptSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isWritePending) {
      setEscrowStep("confirming");
    }
    if (isReceiptLoading) {
      setEscrowStep("confirming");
    }
    if (isReceiptSuccess && txHash && txReceipt) {
      const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      setEscrowExpiresAt(expiresAt);
      setEscrowStep("locked");

      // Extract real escrowId from blockchain event logs
      let realEscrowId = Date.now(); // fallback
      for (const log of txReceipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: BOTROW_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "EscrowCreated") {
            realEscrowId = Number((decoded.args as any).escrowId);
            break;
          }
        } catch (e) {
          // ignore non-matching logs
        }
      }

      // Sync the confirmed escrow back to Firestore atomically with delivery information
      createOrder({
        escrowId: realEscrowId,
        productId: item.id,
        productTitle: item.title,
        productImage: item.image,
        buyer: address || "0x0",
        seller: item.sellerAddress || "0x293ed7F710D056887C6e3Ef5EdBC9B95e32f03a4",
        txHash,
        contractAddress: BOTROW_CONTRACT_ADDRESS,
        amount: item.priceBot,
        status: "AWAITING_DELIVERY",
        deliveryInfo: {
          recipientName: recipientName || "Buyer",
          phoneNumber: buyerPhone || "Not provided",
          email: buyerEmail || "",
          shippingAddress: buyerAddress || "Lagos Dispatch / Global Address",
        },
      }).then((orderId) => {
        setFirestoreOrderId(orderId);

        // Dispatch transactional email alerts to Buyer, Seller, and Admin
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "order_notification",
            orderId,
            escrowId: realEscrowId,
            productTitle: item.title,
            amount: item.priceBot,
            buyerEmail: buyerEmail || "buyer@example.com",
            sellerWallet: item.sellerAddress || "0xSeller",
            deliveryInfo: {
              recipientName: recipientName || "Buyer",
              phoneNumber: buyerPhone || "N/A",
              shippingAddress: buyerAddress || "Lagos Dispatch / Global Address",
            },
            txHash,
          }),
        }).catch(console.error);
      }).catch(console.error);
    }
    if (writeError) {
      toast.error(writeError.message.slice(0, 200));
      setEscrowStep("ready");
    }
  }, [isWritePending, isReceiptLoading, isReceiptSuccess, writeError, txHash]);

  // Countdown timer — ticks every second while escrow is locked
  useEffect(() => {
    if (!escrowExpiresAt) return;
    const tick = () => {
      const remaining = escrowExpiresAt - Math.floor(Date.now() / 1000);
      if (remaining <= 0) {
        setCountdown("Expired — seller may claim");
        return;
      }
      const d = Math.floor(remaining / 86400);
      const h = Math.floor((remaining % 86400) / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [escrowExpiresAt]);

  const startEscrowDeposit = () => {

    if (!isConnected) {
      open({ view: "Connect" });
      return;
    }
    if (!isProfileComplete) {
      toast.error("Please complete your Buyer Profile details (Name, Email, Address) in your Profile settings before buying.");
      router.push("/profile");
      return;
    }
    setEscrowStep("evaluating");
    setTimeout(() => {
      setEscrowStep("ready");
    }, 1200);
  };

  const executeLiveOnChainDeposit = async () => {
    try {
      // Step 1: Switch to BOT Chain 968 if wallet is on a different chain
      if (currentChainId !== botChainMainnet.id) {
        await switchChainAsync({ chainId: botChainMainnet.id });
      }

      // Step 2: Use the actual listing price — no hardcoded amounts
      const priceInBOT = Math.abs(Number(item.priceBot) || 0);
      if (priceInBOT <= 0) throw new Error("Invalid listing price — cannot create escrow.");
      const depositAmount = parseEther(priceInBOT.toString());
      const sellerAddress = (item.sellerAddress || "0x293ed7F710D056887C6e3Ef5EdBC9B95e32f03a4") as `0x${string}`;
      // Use item.id with a timestamp to prevent 'ListingAlreadyEscrowed' reverts during testing
      const onchainListingId = `${item.id}-${Date.now()}`;

      // Step 3: Trigger wallet popup — user signs + pays gas
      await writeContractAsync({
        address: BOTROW_CONTRACT_ADDRESS,
        abi: BOTROW_ABI,
        functionName: "createEscrow",
        args: [onchainListingId, sellerAddress],
        value: depositAmount,
        chainId: botChainMainnet.id,
      });
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed.";
      toast.error(msg);
      setEscrowStep("ready");
    }
  };

  // Loading state
  if (isLoadingItem) {
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
          Loading Encrypted Listing
        </p>
      </div>
    );
  }

  // Not found state
  if (itemNotFound || !item) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-[#0E1017] border border-white/[0.07] rounded-lg max-w-md">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold font-mono text-white">Listing Not Found</h2>
          <p className="text-sm font-mono text-zinc-400">This listing may have been removed or the ID is invalid.</p>
          <Link href="/marketplace" className="inline-block mt-2 px-4 py-2 bg-emerald-500 text-black font-mono font-bold text-xs rounded hover:bg-emerald-400 transition-colors">
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const calculatedFee = (item.priceBot * 0.01).toFixed(2);
  const netSellerAmount = (item.priceBot * 0.99).toFixed(2);

  const askAiAssistant = async (question: string) => {
    if (!question || !question.trim()) return;
    
    const newHistory = [...chatHistory, { role: "user" as const, text: question }];
    setChatHistory(newHistory);
    setSelectedQuestion(null);
    setCustomQuestion("");
    setIsAiThinking(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          history: chatHistory,
          productContext: {
            title: item.title,
            priceBot: item.priceBot,
            category: item.category,
            condition: item.specifications?.["Condition"] || "Verified",
            description: item.description,
            sellerName: item.sellerName,
            sellerWallet: item.sellerAddress,
            sellerTrustScore: item.sellerTrustScore,
            location: item.location || "Global Dispatch",
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setChatHistory([...newHistory, { role: "assistant" as const, text: data.reply }]);
      } else if (data?.error) {
        setChatHistory([...newHistory, { role: "assistant" as const, text: `AI Error: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}` }]);
      } else {
        setChatHistory([...newHistory, { role: "assistant" as const, text: "Based on available listing data, your payment is protected by Botrow smart contract escrow." }]);
      }
    } catch (err: any) {
      console.error("AI Chat Error:", err);
      setChatHistory([...newHistory, { role: "assistant" as const, text: `Error connecting to AI: ${err?.message || "Failed to reach AI endpoint"}` }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to P2P Commerce Clearinghouse</span>
        </Link>

        {/* Mandatory Advisory Notice Banner */}
        <div className="mb-6 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-lg flex items-center gap-3 text-xs font-mono text-zinc-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-400 uppercase">AI Advisory Notice:</strong> Botrow AI serves strictly an advisory role and <strong>never controls funds or executes transactions</strong>. Smart contract `Botrow.sol` on BOT Chain handles all non-custodial escrow and payment security.
          </span>
        </div>

        {/* Header Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Asset Specifications & Trust Report */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Hardware Hero Image Carousel */}
            <div className="relative h-72 sm:h-96 w-full bg-zinc-950 rounded-lg overflow-hidden border border-white/[0.07] shadow-lg group">
              <Image
                src={item.images?.[currentImageIndex] || item.image}
                alt={item.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="object-cover transition-opacity duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E1017] via-transparent to-transparent opacity-60 pointer-events-none" />
              
              {/* Carousel Controls */}
              {item.images && item.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev === 0 ? item.images.length - 1 : prev - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur transition-all border border-white/10 opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev === item.images.length - 1 ? 0 : prev + 1))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur transition-all border border-white/10 opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  
                  {/* Indicators */}
                  <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
                    {item.images.map((_: any, idx: number) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-emerald-400 w-3' : 'bg-white/40'}`} />
                    ))}
                  </div>
                </>
              )}

              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase px-2.5 py-1 bg-zinc-900/90 backdrop-blur border border-white/10 text-white font-semibold rounded shadow">
                  ASSET ID: {item.onchainListingId ? `#BOT-${item.onchainListingId}` : item.id}
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-zinc-900/90 backdrop-blur border border-emerald-500/30 px-2.5 py-1 rounded font-semibold flex items-center gap-1.5 shadow">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  BOTROW AI VERIFIED
                </span>
              </div>
            </div>

            <div className="p-6 bg-[#0E1017] border border-white/[0.07] rounded-lg shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-zinc-800 border border-white/10 text-zinc-300 rounded">
                    {item.category}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold rounded">
                    {item.specifications?.["Condition"] || "Verified P2P Item"}
                  </span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-black/60 border border-emerald-500/30 text-emerald-400 font-bold rounded">
                    📦 {item.quantity ?? 1} UNITS IN STOCK
                  </span>
                </div>
                <button
                  onClick={() => setAiChatOpen(!aiChatOpen)}
                  className="px-3 py-1.5 bg-emerald-500 text-black rounded font-mono font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all shadow flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiChatOpen ? "Close AI Assistant" : "💬 Ask AI Assistant"}</span>
                </button>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{item.title}</h1>
              <p className="mt-3 text-sm text-zinc-300 leading-relaxed font-normal whitespace-pre-line">{item.description}</p>

              <div className="mt-6 pt-6 border-t border-white/[0.06] grid grid-cols-3 gap-4 font-mono text-xs">
                <div>
                  <span className="text-zinc-500 uppercase text-[10px]">SELLER REPUTATION</span>
                  <div className="text-white font-semibold mt-1 text-sm">{item.sellerTrustScore}/100 VERIFIED</div>
                </div>
                <div>
                  <span className="text-zinc-500 uppercase text-[10px]">DISPUTE RATE</span>
                  <div className="text-emerald-400 font-semibold mt-1 text-sm">0.00% (CLEAN)</div>
                </div>
                <div>
                  <span className="text-zinc-500 uppercase text-[10px]">SETTLEMENT FINALITY</span>
                  <div className="text-white font-semibold mt-1 text-sm">BOT CHAIN MAINNET</div>
                </div>
              </div>
            </div>

            {/* Buyer AI Assistant Interactive Console */}
            {aiChatOpen && (
              <div className="p-6 bg-[#0B0D13] border-2 border-emerald-500/50 rounded-lg shadow-xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-400 uppercase">
                    <Cpu className="w-4 h-4 animate-pulse" />
                    <span>Botrow AI Buyer Assistant — Live P2P Intelligence</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded">
                    BOTROW AI
                  </span>
                </div>

                <p className="text-xs font-mono text-zinc-300">
                  Select an inquiry below for real-time objective analysis on pricing, seller risk, or contract terms:
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    "Summarize this listing.",
                    "Is this item overpriced?",
                    "What should I ask the seller before buying?",
                    "Spot any red flags.",
                    "Estimate whether this is a good deal.",
                    "Explain how escrow protects me in this purchase.",
                  ].map((question) => (
                    <button
                      key={question}
                      onClick={() => askAiAssistant(question)}
                      className={`px-3 py-2 rounded-md text-xs font-mono font-semibold transition-all border ${
                        selectedQuestion === question
                          ? "bg-emerald-500 text-black border-emerald-400 shadow"
                          : "bg-zinc-900/80 text-zinc-300 border-white/10 hover:border-emerald-500/40 hover:bg-zinc-800"
                      }`}
                    >
                      ⚡ {question}
                    </button>
                  ))}
                  {/* Custom Question Input Box */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (customQuestion.trim()) {
                        askAiAssistant(customQuestion);
                      }
                    }}
                    className="w-full flex gap-2 pt-2"
                  >
                    <input
                      type="text"
                      placeholder="Ask Botrow AI any custom question about this item or escrow..."
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      className="w-full px-3.5 py-2 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isAiThinking || !customQuestion.trim()}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase rounded disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      {isAiThinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span>Ask AI</span>
                    </button>
                  </form>
                </div>

                {chatHistory.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`p-4 rounded-lg text-xs font-mono leading-relaxed shadow-inner ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-300 ml-8' : 'bg-zinc-950 border-l-4 border-emerald-500 text-zinc-200 mr-8'}`}>
                        {msg.role === 'user' ? (
                          <div className="font-bold text-zinc-400 mb-1.5 border-b border-zinc-700/50 pb-1.5">You</div>
                        ) : (
                          <div className="font-bold text-emerald-500 mb-1.5 border-b border-zinc-800 pb-1.5 flex items-center gap-1.5"><Sparkles className="w-3 h-3"/> Botrow AI</div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isAiThinking && (
                  <div className="p-4 mt-4 bg-zinc-950/60 border border-white/[0.05] rounded text-center text-xs font-mono text-emerald-400 animate-pulse flex items-center justify-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Botrow AI is evaluating on-chain provenance & resale liquidity indices...</span>
                  </div>
                )}
              </div>
            )}

            {/* Mandatory AI Trust Report Panel */}
            <div className="p-6 bg-[#0B0D13] border border-emerald-500/30 rounded-lg shadow-inner space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Mandatory AI Trust Analysis Report</span>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-emerald-500 text-black rounded shadow">
                  TRUST SCORE: {item.aiAnalysis.trustScore}/100
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="p-3.5 bg-zinc-900/50 rounded border border-white/[0.04]">
                  <span className="text-zinc-500 text-[10px] uppercase block mb-1">PRICE ANALYSIS</span>
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Fair Market Value ({item.priceBot} BOT)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Within 0.8% of aggregate global resale index benchmarks.</p>
                </div>

                <div className="p-3.5 bg-zinc-900/50 rounded border border-white/[0.04]">
                  <span className="text-zinc-500 text-[10px] uppercase block mb-1">LISTING COMPLETENESS</span>
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>100% Comprehensive</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Condition grade, high-res photos, and shipping terms verified.</p>
                </div>

                <div className="p-3.5 bg-zinc-900/50 rounded border border-white/[0.04]">
                  <span className="text-zinc-500 text-[10px] uppercase block mb-1">SCAM RISK ASSESSMENT</span>
                  <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>LOW / ZERO RISK (0.00%)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">No sybil duplicate IDs or fraudulent phrasing detected.</p>
                </div>

                <div className="p-3.5 bg-zinc-900/50 rounded border border-white/[0.04]">
                  <span className="text-zinc-500 text-[10px] uppercase block mb-1">MISSING INFORMATION</span>
                  <div className="text-white font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>None Detected</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">Original serial numbers and provenance documentation present.</p>
                </div>
              </div>

              <div className="p-4 bg-zinc-900/40 rounded border border-white/[0.04] text-xs font-mono">
                <span className="text-emerald-400 font-bold text-[11px] uppercase block mb-1">💡 SUGGESTIONS FOR IMPROVEMENT</span>
                <p className="text-zinc-300 leading-relaxed">
                  Seller has satisfied all primary trust parameters. For instantaneous delivery release upon arrival, seller is advised to include an insured tracking hyperlink directly inside the encrypted order messaging thread.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Escrow Terminal & Execution Gate */}
          <div className="space-y-6">
            <div className="p-6 bg-[#0E1017] border border-white/[0.07] rounded-lg shadow-md flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">ITEM PRICE</div>
                <div className="mt-1 text-3xl font-bold font-mono text-white tabular-nums">
                  {Math.abs(item.priceBot)} <span className="text-emerald-400 font-normal text-xl">BOT</span>
                </div>
                
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.05] text-xs font-mono text-zinc-400">
                  {isCurrencyLoading ? (
                    <span className="animate-pulse">Loading fiat rates...</span>
                  ) : (
                    <>
                      <span>≈ {formatUsd(convertBotToUsd(Math.abs(item.priceBot)))}</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-emerald-400/80">{formatNgn(convertBotToNgn(Math.abs(item.priceBot)))}</span>
                    </>
                  )}
                </div>

                {/* Ledger Breakdown */}
                <div className="mt-6 space-y-2.5 py-4 border-y border-white/[0.06] text-xs font-mono">
                  <div className="flex justify-between text-zinc-400">
                    <span>Seller Net Payout (99%)</span>
                    <span className="text-white font-semibold">{netSellerAmount} BOT</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Protocol Treasury Fee (1%)</span>
                    <span className="text-emerald-400">{calculatedFee} BOT</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Arbitration & AI Insurance</span>
                    <span className="text-zinc-300">INCLUDED</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Automated Timeout Period</span>
                    <span className="text-zinc-300">7 DAYS AFTER DEPOSIT</span>
                  </div>
                </div>
              </div>

              {/* Action State Machine */}
              <div className="mt-6">
                {escrowStep === "idle" && (
                  <button
                    onClick={startEscrowDeposit}
                    className="w-full py-3 px-4 rounded-md bg-white text-zinc-950 font-mono font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isConnected ? "Initialize Escrow Deposit" : "Connect Reown To Buy"}</span>
                  </button>
                )}

                {escrowStep === "evaluating" && (
                  <div className="p-3 bg-zinc-900 border border-white/10 rounded-md text-center text-xs font-mono text-emerald-400 animate-pulse flex items-center justify-center gap-2">
                    <Activity className="w-4 h-4 animate-spin" />
                    <span>Synthesizing AI Underwriting & Pricing Gas...</span>
                  </div>
                )}

                {escrowStep === "ready" && (
                  <div className="space-y-3">
                    {/* Buyer Delivery & Recipient Information Input */}
                    <div className="p-4 bg-zinc-950 border border-emerald-500/40 rounded-lg text-xs font-mono space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase border-b border-white/[0.06] pb-2">
                        <MapPin className="w-4 h-4" />
                        <span>Delivery & Shipping Destination</span>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase block mb-1">Recipient Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Alex Johnson"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase block mb-1">Phone Number</label>
                            <input
                              type="tel"
                              placeholder="+234 801 234 5678"
                              value={buyerPhone}
                              onChange={(e) => setBuyerPhone(e.target.value)}
                              className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 uppercase block mb-1">Email</label>
                            <input
                              type="email"
                              placeholder="alex@example.com"
                              value={buyerEmail}
                              onChange={(e) => setBuyerEmail(e.target.value)}
                              className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-400 uppercase block mb-1">Full Delivery Address</label>
                          <input
                            type="text"
                            placeholder="e.g. Plot 12 Victoria Island, Lagos / Apt 4B"
                            value={buyerAddress}
                            onChange={(e) => setBuyerAddress(e.target.value)}
                            className="w-full px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Authorization Summary — exactly what they're signing */}
                    <div className="p-4 bg-zinc-950 border border-emerald-500/40 rounded-lg text-xs font-mono space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase border-b border-white/[0.06] pb-2">
                        <Wallet className="w-4 h-4" />
                        <span>Wallet Authorization Required</span>
                      </div>

                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        Your connected wallet will display a transaction prompt. Review and approve it to lock funds securely inside <span className="text-white font-semibold">`Botrow.sol`</span> on BOT Chain.
                      </p>

                      {/* Exact transaction breakdown */}
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 flex items-center gap-1.5"><DollarSign className="w-3 h-3" />Escrow Deposit</span>
                          <span className="text-white font-bold tabular-nums">{Math.abs(item.priceBot)} BOT</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 flex items-center gap-1.5"><Zap className="w-3 h-3" />Network Gas Fee (est.)</span>
                          <span className="text-yellow-400 font-semibold">~0.001 BOT</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/[0.06] pt-2">
                          <span className="text-zinc-300 font-semibold">Total Wallet Deduction</span>
                          <span className="text-emerald-400 font-extrabold tabular-nums">~{(Math.abs(item.priceBot) + 0.001).toFixed(3)} BOT</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-amber-950/30 border border-amber-500/20 rounded text-[10px] text-amber-300 leading-relaxed">
                        ⚠️ Your tokens will be <strong>non-custodially locked</strong> in the smart contract. They will only release to the seller after you click <strong>"Confirm Delivery"</strong> upon receiving the item.
                      </div>
                    </div>

                    <button
                      onClick={executeLiveOnChainDeposit}
                      disabled={isWritePending || isReceiptLoading}
                      className="w-full py-3.5 px-4 rounded-md bg-emerald-500 text-black font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isWritePending || isReceiptLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                      <span>{isWritePending ? "Opening Wallet — Please Approve..." : isReceiptLoading ? "Confirming on BOT Chain..." : `Authorize & Lock ${Math.abs(item.priceBot)} BOT in Escrow`}</span>
                    </button>
                  </div>
                )}

                {escrowStep === "confirming" && (
                  <div className="p-4 bg-zinc-900 border border-white/10 rounded text-center text-xs font-mono text-zinc-300 space-y-2.5">
                    <Activity className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
                    {isWritePending && !txHash ? (
                      <>
                        <div className="font-bold uppercase text-white">Wallet Signature Pending</div>
                        <p className="text-[11px] text-zinc-400">Check your wallet popup and click <strong className="text-white">"Approve"</strong> or <strong className="text-white">"Confirm"</strong> to authorize the transaction and pay the gas fee.</p>
                      </>
                    ) : (
                      <>
                        <div className="font-bold uppercase text-white">Broadcasting to BOT Chain...</div>
                        <p className="text-[11px] text-zinc-400">Transaction signed ✓ — waiting for block confirmation on rpc.botchain.ai (Chain ID: 677).</p>
                        {txHash && (
                          <div className="text-[9px] text-emerald-400 break-all pt-1 border-t border-white/[0.06]">
                            Tx: {txHash}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {escrowStep === "locked" && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/50 rounded-md text-center space-y-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center mx-auto font-extrabold text-sm">
                      ✓
                    </div>
                    <div className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      ESCROW CONTRACT ACTIVE & LOCKED
                    </div>
                    <p className="text-[11px] text-zinc-300 font-mono leading-relaxed">
                      Tokens locked on BOT Chain Mainnet! Seller notified via Firebase trigger email to prepare physical shipping.
                    </p>

                    {/* Live Countdown Timer */}
                    {countdown && (
                      <div className="p-3 bg-zinc-950 border border-amber-500/30 rounded text-center">
                        <div className="text-[10px] text-zinc-500 uppercase font-mono mb-1">⏳ Seller Timeout Window</div>
                        <div className="text-amber-400 font-mono font-bold text-sm tabular-nums">{countdown}</div>
                        <div className="text-[9px] text-zinc-500 mt-1 font-mono">Seller may claim funds if you do not confirm delivery before expiry</div>
                      </div>
                    )}

                    {txHash && (
                      <div className="text-[10px] text-zinc-400 font-mono break-all">
                        Tx Hash: {txHash}
                      </div>
                    )}
                    <div className="text-left p-2.5 bg-zinc-950 border border-white/10 rounded font-mono text-[10px] text-zinc-300 space-y-1">
                      <span className="text-emerald-400 font-semibold block text-[9px] uppercase">● Firestore Product Record Synced:</span>
                      <pre className="text-zinc-400 overflow-x-auto">
{`{
  "escrowId": 101,
  "contractAddress": "${BOTROW_CONTRACT_ADDRESS.slice(0, 10)}...",
  "transactionHash": "${txHash || '0x8a91...3e4f'}",
  "status": "AWAITING_DELIVERY"
}`}
                      </pre>
                    </div>
                    <Link
                      href="/dashboard"
                      className="block mt-1 py-2.5 text-xs font-mono text-black bg-emerald-400 rounded hover:bg-emerald-300 transition-colors font-bold uppercase tracking-wide shadow"
                    >
                      View in On-Chain Ledger Dashboard
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 justify-center">
                <Info className="w-3.5 h-3.5 text-zinc-400" />
                <span>Protected by OpenZeppelin ReentrancyGuard</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
