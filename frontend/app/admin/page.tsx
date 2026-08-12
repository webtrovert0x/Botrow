"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { FirestoreOrder } from "@/lib/firestore";
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Bot, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { BOTROW_CONTRACT_ADDRESS, BOTROW_ABI } from "@/constants/contract";
import DisputeChat from "@/components/DisputeChat";

// The authorized protocol admin wallet address
const ADMIN_WALLET = "0x293ed7F710D056887C6e3Ef5EdBC9B95e32f03a4"; // You can change this to your actual wallet address

export default function AdminDashboardPage() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const [disputedOrders, setDisputedOrders] = useState<(FirestoreOrder & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchDisputedOrders = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "orders"), where("status", "==", "DISPUTED"));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as FirestoreOrder),
      }));
      setDisputedOrders(orders);
    } catch (err) {
      console.error("Failed to fetch disputed orders:", err);
      toast.error("Failed to load admin dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputedOrders();
  }, []);

  const { writeContractAsync } = useWriteContract();

  const handleResolveDispute = async (order: FirestoreOrder & { id: string }, awardToSeller: boolean) => {
    setProcessingId(order.id);
    try {
      if (!order.escrowId) {
        toast.error("Error: Missing on-chain escrow ID");
        return;
      }

      toast.loading("Please sign the resolution transaction in your wallet...", { id: "tx" });

      // 1. Execute On-Chain Dispute Resolution (Admin Only)
      const txHash = await writeContractAsync({
        address: BOTROW_CONTRACT_ADDRESS,
        abi: BOTROW_ABI,
        functionName: "resolveDispute",
        args: [BigInt(order.escrowId), awardToSeller],
      });

      toast.loading(`Transaction signed: ${txHash.substring(0, 8)}... waiting for confirmation.`, { id: "tx" });

      // Wait for block confirmation before updating the database!
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== "success") {
          throw new Error("Transaction reverted on the blockchain.");
        }
      }
      
      // 2. Update Firestore State
      const orderRef = doc(db, "orders", order.id);
      await updateDoc(orderRef, {
        status: "RESOLVED",
        humanVerified: true,
        winner: awardToSeller ? "seller" : "buyer",
        resolutionTxHash: txHash,
        updatedAt: serverTimestamp()
      });

      toast.success(awardToSeller ? "Funds released to Seller on-chain!" : "Funds refunded to Buyer on-chain!", { id: "tx" });
      
      // 3. Trigger email notification to Buyer, Seller, and Admin
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispute_resolved",
          orderId: order.id,
          productTitle: order.productTitle,
          winner: awardToSeller ? "seller" : "buyer",
          buyerAddress: order.buyer,
          sellerAddress: order.seller
        }),
      }).catch(err => console.error("Failed to trigger dispute_resolved email", err));
      
      await fetchDisputedOrders();
    } catch (err: any) {
      console.error("Resolution error:", err);
      toast.error(err?.shortMessage || err?.message || "Failed to execute dispute resolution on-chain", { id: "tx" });
    } finally {
      setProcessingId(null);
    }
  };

  // ─────────────────────────────────────────────
  // ZERO-TRUST AUTHORIZATION CHECK
  // ─────────────────────────────────────────────
  if (!isConnected || address?.toLowerCase() !== ADMIN_WALLET.toLowerCase()) {
    return (
      <div className="min-h-screen bg-[#090A0F] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0E1017] border border-red-500/20 rounded-xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Lock className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold font-mono text-white">ACCESS DENIED</h2>
          <p className="text-xs font-mono text-zinc-400 leading-relaxed">
            This terminal is restricted to Botrow Protocol Administrators. Your connected Web3 wallet <span className="text-red-400 font-bold">{address || "Not Connected"}</span> is not authorized.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Admin Header */}
        <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-xs font-mono text-red-400 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>PROTOCOL ADMIN TERMINAL</span>
          </div>
          <h1 className="text-2xl font-bold font-mono text-white tracking-tight">
            Human-in-the-Loop Dispute Resolution
          </h1>
          <p className="mt-1 text-xs font-mono text-zinc-400">
            Review preliminary rulings generated by the Botrow AI Judge. Verify the evidence and cryptographically execute the final settlement on the BOT Chain.
          </p>
        </div>

        {/* Orders List */}
        {isLoading ? (
          <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg">
            <Loader2 className="w-6 h-6 text-red-400 animate-spin mx-auto mb-2" />
            <span className="text-xs font-mono text-zinc-400">Loading active disputes...</span>
          </div>
        ) : disputedOrders.length === 0 ? (
          <div className="p-12 text-center bg-[#0E1017] border border-white/[0.07] rounded-lg space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-mono text-zinc-400">Zero active disputes. The protocol is running smoothly.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {disputedOrders.map((order) => (
              <div key={order.id} className="p-6 bg-[#0E1017] border border-red-500/30 rounded-lg space-y-6 shadow-sm">
                
                <div className="flex flex-col md:flex-row justify-between gap-4 border-b border-white/[0.05] pb-4">
                  <div>
                    <div className="text-xs font-mono font-bold text-red-400 mb-1 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> ESCROW #{order.escrowId || "101"}
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {order.productTitle || `Product #${order.productId}`}
                    </h3>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xl font-bold text-white">{order.amount} BOT</div>
                    <div className="text-xs text-zinc-500">Locked in Smart Contract</div>
                  </div>
                </div>

                <div className="mt-6 border-t border-red-500/30 pt-6">
                  <h4 className="text-sm font-bold font-mono text-red-400 mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Official Dispute Chat
                  </h4>
                  <DisputeChat order={order as any} currentUserAddress={address as string} userRole="ADMIN" />
                </div>

                {/* Human Verification Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-white/[0.05]">
                  <button
                    onClick={() => handleResolveDispute(order, false)}
                    disabled={processingId === order.id}
                    className="w-full sm:w-auto px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-mono font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Refund Buyer
                  </button>
                  <button
                    onClick={() => handleResolveDispute(order, true)}
                    disabled={processingId === order.id}
                    className="w-full sm:w-auto px-6 py-2.5 bg-red-500 hover:bg-red-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 shadow disabled:opacity-50"
                  >
                    {processingId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    Release to Seller
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
