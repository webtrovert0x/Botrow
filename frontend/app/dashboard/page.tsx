"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useBalance, useReadContract, useWriteContract, useSwitchChain, useChainId, usePublicClient } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { formatEther } from "viem";
import { BOTROW_CONTRACT_ADDRESS, BOTROW_ABI } from "@/constants/contract";
import { botChainMainnet } from "@/config/chains";
import { getOrdersByBuyer, getOrdersBySeller, updateOrderStatus, FirestoreOrder, formatUserDisplayName } from "@/lib/firestore";
import FiatRampModal from "@/components/FiatRampModal";
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, ArrowRight, ExternalLink, RefreshCw, Terminal, Clock, Cpu, User, Phone, MapPin, Truck, ShoppingBag, DollarSign, Loader2, Info, Send } from "lucide-react";
import toast from "react-hot-toast";
import { useCurrency } from "@/hooks/useCurrency";
import DisputeChat from "@/components/DisputeChat";
import { addDisputeMessage } from "@/lib/firestore";

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { data: balanceData } = useBalance({ address });
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { convertBotToUsd, convertBotToNgn, formatUsd, formatNgn, isLoading: isCurrencyLoading } = useCurrency();

  // Tab State: "buyer" | "seller"
  const [activeTab, setActiveTab] = useState<"buyer" | "seller">("buyer");
  const [isFiatModalOpen, setIsFiatModalOpen] = useState(false);

  // Real Firestore Orders
  const [buyerOrders, setBuyerOrders] = useState<(FirestoreOrder & { id: string })[]>([]);
  const [sellerOrders, setSellerOrders] = useState<(FirestoreOrder & { id: string })[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);

  // Wagmi write contract hook for on-chain confirmDelivery & openDispute
  const { writeContractAsync } = useWriteContract();
  const [activeTxId, setActiveTxId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Dispute Flow State
  const [disputingOrderId, setDisputingOrderId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  // Fetch real Firestore orders on mount / address change
  const fetchDashboardOrders = async () => {
    if (!address) return;
    setIsLoadingOrders(true);
    try {
      const [buyerData, sellerData] = await Promise.all([
        getOrdersByBuyer(address),
        getOrdersBySeller(address),
      ]);
      setBuyerOrders(buyerData);
      setSellerOrders(sellerData);
    } catch (err) {
      console.error("Dashboard order fetch error:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchDashboardOrders();
  }, [address]);

  // Handle live on-chain delivery confirmation by buyer
  const handleConfirmDelivery = async (escrowId: number, firestoreOrderId: string) => {
    try {
      setActiveTxId(escrowId);
      setStatusMessage(`Broadcasting delivery confirmation on BOT Chain (Escrow #${escrowId})...`);

      // Switch chain to BOT Chain 968 if needed
      if (currentChainId !== botChainMainnet.id) {
        await switchChainAsync({ chainId: botChainMainnet.id });
      }

      // Execute on-chain confirmDelivery call
      const txHash = await writeContractAsync({
        address: BOTROW_CONTRACT_ADDRESS,
        abi: BOTROW_ABI,
        functionName: "confirmDelivery",
        args: [BigInt(escrowId)],
        chainId: botChainMainnet.id,
      });

      // Wait for block confirmation before updating the database!
      setStatusMessage(`Transaction signed (Tx: ${txHash.slice(0, 8)}...). Waiting for block confirmation...`);
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on the blockchain.");
        }
      }

      // Update Firestore order status to DELIVERED ONLY if successful
      await updateOrderStatus(firestoreOrderId, "DELIVERED");

      // Find the order context to send the email
      const order = buyerOrders.find(o => o.id === firestoreOrderId);
      if (order) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "escrow_settled",
            escrowId: escrowId,
            productTitle: order.productTitle,
            amount: order.amount,
            sellerWallet: order.seller,
          }),
        }).catch(err => console.error("Failed to trigger settlement email", err));
      }

      toast.success("Delivery confirmed on-chain! Escrow settled.");
      await fetchDashboardOrders();
    } catch (err: any) {
      console.error("Confirmation error:", err);
      toast.error(`Confirmation failed: ${err.message || "Unknown error"}`);
    } finally {
      setActiveTxId(null);
      setStatusMessage(null);
    }
  };

  // Submit Dispute (Start Chat)
  const submitDispute = async () => {
    if (!disputingOrderId || !disputeReason || !address) return;
    setIsSubmittingDispute(true);
    try {
      // Find the specific order to get the escrowId
      const targetOrder = [...buyerOrders, ...sellerOrders].find(o => o.id === disputingOrderId);
      if (!targetOrder || !targetOrder.escrowId) throw new Error("Missing escrow ID");

      setStatusMessage(`Broadcasting openDispute on BOT Chain (Escrow #${targetOrder.escrowId})...`);

      // Switch chain to BOT Chain 968 if needed
      if (currentChainId !== botChainMainnet.id) {
        await switchChainAsync({ chainId: botChainMainnet.id });
      }

      // 1. Execute on-chain openDispute
      const txHash = await writeContractAsync({
        address: BOTROW_CONTRACT_ADDRESS,
        abi: BOTROW_ABI,
        functionName: "openDispute",
        args: [BigInt(targetOrder.escrowId)],
        chainId: botChainMainnet.id,
      });

      setStatusMessage(`Transaction signed (Tx: ${txHash.slice(0, 8)}...). Waiting for confirmation...`);
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on the blockchain.");
        }
      }

      // 2. Update status to DISPUTED
      await updateOrderStatus(disputingOrderId, "DISPUTED");
      
      // 3. Add initial message to chat
      await addDisputeMessage(disputingOrderId, {
        senderRole: "BUYER", // Note: either buyer or seller could open dispute, assuming buyer here since it's the dashboard UI flow
        senderAddress: address,
        text: disputeReason
      });
      
      // 4. Inject automatic AI response asking for proof
      await addDisputeMessage(disputingOrderId, {
        senderRole: "AI",
        senderAddress: "Botrow AI Judge",
        text: "Hello, I am the Botrow AI Judge. I have been assigned to this dispute. Please provide photo or video evidence of the item to support your claims. I will review the evidence and issue a ruling."
      });

      // 5. Trigger email notification to Buyer, Seller, and Admin
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispute_opened",
          orderId: targetOrder.id,
          productTitle: targetOrder.productTitle,
          amount: targetOrder.amount,
          buyerAddress: targetOrder.buyer,
          sellerAddress: targetOrder.seller,
          disputeReason: disputeReason
        }),
      }).catch(err => console.error("Failed to trigger dispute_opened email", err));

      toast.success("Dispute opened on-chain. The chat is now active.");
      setDisputingOrderId(null);
      setDisputeReason("");
      await fetchDashboardOrders();
    } catch (err: any) {
      console.error("Dispute error:", err);
      toast.error(err.shortMessage || err.message || "Network error while opening dispute");
    } finally {
      setIsSubmittingDispute(false);
      setStatusMessage(null);
    }
  };

  const handleNotifyShipped = async (order: any) => {
    const toastId = toast.loading("Sending shipping notification...");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order_shipped",
          escrowId: order.escrowId,
          productTitle: order.productTitle,
          buyerEmail: order.deliveryInfo?.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Buyer notified successfully!", { id: toastId });
      } else {
        toast.error(data.error || "Failed to notify buyer.", { id: toastId });
      }
    } catch (err: any) {
      toast.error("Network error.", { id: toastId });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#090A0F] text-zinc-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full p-8 bg-[#0E1017] border border-white/[0.07] rounded-lg text-center shadow-lg">
          <Lock className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white tracking-tight font-mono">ENCRYPTED DASHBOARD ACCESS</h2>
          <p className="mt-2 text-xs text-zinc-400 font-mono leading-relaxed">
            Connect your Reown Web3 wallet to manage ongoing deliveries, track locked escrow deposits, and confirm buyer arrivals.
          </p>
          <button
            onClick={() => open({ view: "Connect" })}
            className="mt-6 w-full py-2.5 rounded-md bg-emerald-500 text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-colors"
          >
            CONNECT WALLET
          </button>
        </div>
      </div>
    );
  }

  // Count active awaiting deliveries
  const activeBuyerCount = buyerOrders.filter((o) => o.status === "AWAITING_DELIVERY").length;
  const activeSellerCount = sellerOrders.filter((o) => o.status === "AWAITING_DELIVERY").length;

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="p-6 bg-[#0E1017] border border-white/[0.07] rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-2">
              <Terminal className="w-4 h-4" />
              <span>ON-CHAIN ESCROW COMMAND CENTER</span>
            </div>
            <h1 className="text-2xl font-bold font-mono text-white tracking-tight">
              Order & Shipping Dashboard
            </h1>
            <p className="mt-1 text-xs font-mono text-zinc-400 flex items-center gap-2">
              <span className="truncate max-w-[120px] sm:max-w-none inline-block align-bottom">Connected Wallet: <span className="text-zinc-200 break-all">{address?.slice(0,6)}...{address?.slice(-4)}</span></span>
              <span className="text-zinc-600">|</span>
              <span className="whitespace-nowrap">Balance: <span className="text-emerald-400 font-bold">{balanceData ? parseFloat(formatEther(balanceData.value)).toFixed(4) : "0.00"} BOT</span></span>
              <button 
                onClick={() => setIsFiatModalOpen(true)}
                className="ml-2 px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold uppercase rounded transition-colors"
              >
                Buy / Sell BOT
              </button>
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <Link
              href="/profile"
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white rounded font-mono text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Edit Profile & Address</span>
            </Link>
            <button
              onClick={fetchDashboardOrders}
              className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 rounded font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? "animate-spin" : ""}`} />
              <span>Refresh Orders</span>
            </button>
            <Link
              href="/marketplace"
              className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 rounded font-mono text-xs font-bold uppercase transition-colors"
            >
              Marketplace
            </Link>
          </div>
        </div>

        {/* Global Status Banner */}
        {statusMessage && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Dual Role Navigation Tabs */}
        <div className="flex overflow-x-auto whitespace-nowrap border-b border-white/[0.08] font-mono text-xs pb-1 custom-scrollbar">
          <button
            onClick={() => setActiveTab("buyer")}
            className={`py-3 px-6 font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 ${
              activeTab === "buyer"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Buyer Dashboard ({buyerOrders.length} Purchases)</span>
            {activeBuyerCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-black font-extrabold">
                {activeBuyerCount} Active
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("seller")}
            className={`py-3 px-6 font-bold uppercase tracking-wider flex items-center gap-2 transition-all border-b-2 ${
              activeTab === "seller"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Seller Dashboard ({sellerOrders.length} Sales & Deliveries)</span>
            {activeSellerCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-extrabold">
                {activeSellerCount} To Ship
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: BUYER DASHBOARD */}
        {activeTab === "buyer" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold font-mono uppercase text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-400" />
                  <span>My Escrow Purchases & Delivery Tracking</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Items you purchased. Your BOT tokens are safely locked in smart contract escrow until you inspect the physical package and click Confirm Delivery.
                </p>
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg">
                <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-2" />
                <span className="text-xs font-mono text-zinc-400">Fetching buyer escrow records from Firestore...</span>
              </div>
            ) : buyerOrders.length === 0 ? (
              <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg space-y-3">
                <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">No purchase escrows found for your wallet address.</p>
                <Link
                  href="/marketplace"
                  className="inline-block px-4 py-2 bg-emerald-500 text-black font-mono text-xs font-bold uppercase rounded hover:bg-emerald-400 transition-colors"
                >
                  Browse P2P Marketplace
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {buyerOrders.map((order) => (
                  <div key={order.id} className="p-6 bg-[#0E1017] border border-white/[0.07] rounded-lg space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-emerald-400">ESCROW #{order.escrowId || "101"}</span>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                            order.status === "AWAITING_DELIVERY"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : order.status === "DISPUTED"
                              ? "bg-red-500/10 text-red-300 border-red-500/30"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          }`}>
                            {order.status === "AWAITING_DELIVERY" ? "● AWAITING PHYSICAL DELIVERY" 
                             : order.status === "DISPUTED" ? "⚠️ DISPUTE OPEN (AI PENDING)"
                             : "✓ DELIVERED & SETTLED"}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1">
                          {order.productTitle || `P2P Item (Product #${order.productId.slice(0, 8)})`}
                        </h3>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xl font-bold text-white tabular-nums">{order.amount} BOT</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {isCurrencyLoading ? "..." : `≈ ${formatUsd(convertBotToUsd(order.amount))} / ${formatNgn(convertBotToNgn(order.amount))}`}
                        </div>
                      </div>
                    </div>

                    {/* Delivery Destination & Seller Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-3.5 bg-zinc-950/80 rounded border border-white/[0.05] space-y-1.5">
                        <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" /> Delivery Shipping Destination
                        </div>
                        <div className="text-zinc-200 font-medium">{order.deliveryInfo?.recipientName || "Buyer"}</div>
                        <div className="text-zinc-400">{order.deliveryInfo?.shippingAddress || "Lagos / Global Address"}</div>
                        <div className="text-zinc-500 text-[11px]">Phone: {order.deliveryInfo?.phoneNumber || "N/A"}</div>
                      </div>

                      <div className="p-3.5 bg-zinc-950/80 rounded border border-white/[0.05] space-y-1.5">
                        <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" /> Merchant Seller Information
                        </div>
                        <div className="text-zinc-200 font-mono font-bold">{formatUserDisplayName(undefined, order.seller)}</div>
                        <div className="text-zinc-400 text-[11px] pt-1">
                          Tx Hash: <a href={`https://scan.botchain.ai/tx/${order.txHash}`} target="_blank" rel="noreferrer" className="text-emerald-400 underline">{order.txHash ? `${order.txHash.slice(0, 14)}...` : "0x..."}</a>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    {order.status === "AWAITING_DELIVERY" ? (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <p className="text-[11px] font-mono text-zinc-400 w-full sm:w-1/2">
                          Package arrived? Inspect working condition then click below to release tokens to seller. Or open a dispute if there is an issue.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDisputingOrderId(order.id)}
                            className="px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:bg-red-950 hover:text-red-400 hover:border-red-900 text-zinc-300 font-mono font-bold text-xs uppercase tracking-wider rounded transition-all"
                          >
                            Open Dispute
                          </button>
                          <button
                            onClick={() => handleConfirmDelivery(order.escrowId, order.id)}
                            disabled={activeTxId === order.escrowId}
                            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 shadow disabled:opacity-50 shrink-0"
                          >
                            {activeTxId === order.escrowId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{activeTxId === order.escrowId ? "Confirming..." : "Confirm Delivery"}</span>
                          </button>
                        </div>
                      </div>
                    ) : order.status === "DISPUTED" ? (
                      <div className="pt-4 mt-4 border-t border-white/[0.06]">
                        <DisputeChat order={order as any} currentUserAddress={address as string} userRole="BUYER" />
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded text-xs font-mono text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Escrow complete! Tokens successfully disbursed to seller wallet on BOT Chain.</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SELLER DASHBOARD */}
        {activeTab === "seller" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold font-mono uppercase text-white flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-400" />
                  <span>Incoming Sales & Shipping Deliveries</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Orders placed for your items. Inspect the buyer's delivery name, phone number, and shipping address to dispatch couriers.
                </p>
              </div>
            </div>

            {isLoadingOrders ? (
              <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin mx-auto mb-2" />
                <span className="text-xs font-mono text-zinc-400">Fetching seller delivery orders from Firestore...</span>
              </div>
            ) : sellerOrders.length === 0 ? (
              <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg space-y-3">
                <Truck className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-mono text-zinc-400">No active incoming sales found for your seller address.</p>
                <Link
                  href="/create"
                  className="inline-block px-4 py-2 bg-emerald-500 text-black font-mono text-xs font-bold uppercase rounded hover:bg-emerald-400 transition-colors"
                >
                  Create New P2P Advert
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map((order) => (
                  <div key={order.id} className="p-6 bg-[#0E1017] border border-white/[0.07] rounded-lg space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.06] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-400">ESCROW #{order.escrowId || "101"}</span>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                            order.status === "AWAITING_DELIVERY"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                          }`}>
                            {order.status === "AWAITING_DELIVERY" ? "⚡ DISPATCH NEEDED — AWAITING SHIPPING" : "✓ DELIVERED & PAID"}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white mt-1">
                          {order.productTitle || `P2P Item (Product #${order.productId.slice(0, 8)})`}
                        </h3>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xl font-bold text-emerald-400 tabular-nums">{order.amount} BOT</div>
                        <div className="text-[10px] text-zinc-500">
                          {isCurrencyLoading ? "..." : `≈ ${formatUsd(convertBotToUsd(order.amount))} / ${formatNgn(convertBotToNgn(order.amount))}`}
                        </div>
                      </div>
                    </div>

                    {/* Buyer Shipping & Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                      <div className="p-4 bg-zinc-950/80 rounded border border-amber-500/20 space-y-2">
                        <div className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5" /> Buyer Shipping Destination
                        </div>
                        <div className="text-white font-bold text-sm">{order.deliveryInfo?.recipientName || "Buyer"}</div>
                        <div className="text-zinc-200 flex items-start gap-1.5 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                          <span>{order.deliveryInfo?.shippingAddress || "Lagos Dispatch / Global Address"}</span>
                        </div>
                        <div className="text-zinc-300 flex items-center gap-1.5 pt-0.5">
                          <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span>{order.deliveryInfo?.phoneNumber || "N/A"}</span>
                        </div>
                        {order.deliveryInfo?.email && (
                          <div className="text-zinc-400 text-[11px] flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span>{order.deliveryInfo.email}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-zinc-950/80 rounded border border-white/[0.05] space-y-2">
                        <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Blockchain Escrow Parameters
                        </div>
                        <div className="text-zinc-300">Contract: <span className="text-white font-mono break-all">{BOTROW_CONTRACT_ADDRESS.slice(0, 12)}...</span></div>
                        <div className="text-zinc-300">Buyer Wallet: <span className="text-zinc-100 font-mono font-bold break-all">{formatUserDisplayName(order.deliveryInfo?.recipientName, order.buyer)}</span></div>
                        <div className="text-zinc-400 text-[11px] pt-1 border-t border-white/[0.05] break-all">
                          Tx: <a href={`https://scan.botchain.ai/tx/${order.txHash}`} target="_blank" rel="noreferrer" className="text-emerald-400 underline">{order.txHash ? `${order.txHash.slice(0, 16)}...` : "0x..."}</a>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
                      {order.status === "AWAITING_DELIVERY" ? (
                        <>
                          <div className="p-3 bg-zinc-900/60 border border-white/[0.05] rounded text-xs font-mono text-zinc-400 flex items-center justify-between flex-grow">
                            <span>Dispatch courier to buyer's address above.</span>
                            <span className="text-emerald-400 font-bold">7-Day Auto Timeout Protected</span>
                          </div>
                          
                          {order.deliveryInfo?.email && (
                            <button
                              onClick={() => handleNotifyShipped(order)}
                              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-400 font-mono text-xs font-bold transition-all whitespace-nowrap"
                            >
                              <Send className="w-3.5 h-3.5" /> Notify Buyer Shipped
                            </button>
                          )}
                        </>
                      ) : order.status === "DISPUTED" ? (
                        <div className="w-full">
                          <DisputeChat order={order as any} currentUserAddress={address as string} userRole="SELLER" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Fiat Gateway Modal */}
      <FiatRampModal 
        isOpen={isFiatModalOpen}
        onClose={() => setIsFiatModalOpen(false)}
        walletAddress={address}
      />

      {/* Open Dispute Modal */}
      {disputingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#090A0F] border border-red-500/30 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="p-4 bg-red-950/30 border-b border-red-500/20 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-sm font-bold font-mono text-red-400">Open AI Escrow Dispute</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                Please provide a brief reason for opening the dispute. After opening, a chat window will appear where you can upload images/videos and discuss with the seller and AI Judge.
              </p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Example: The item arrived broken..."
                className="w-full h-32 p-3 bg-[#0E1017] border border-zinc-800 focus:border-red-500/50 rounded-lg text-sm text-zinc-200 outline-none resize-none font-mono"
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDisputingOrderId(null)}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs font-bold uppercase rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDispute}
                  disabled={isSubmittingDispute || !disputeReason.trim()}
                  className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 font-mono text-xs font-bold uppercase rounded transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingDispute ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Submit Evidence
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
