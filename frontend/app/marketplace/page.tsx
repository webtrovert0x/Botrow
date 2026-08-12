"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProducts, FirestoreProduct, formatUserDisplayName, getUser } from "@/lib/firestore";
import { ShieldCheck, Search, Cpu, CheckCircle2, ArrowUpRight, Lock, Tag, Loader2, Hexagon } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [firestoreItems, setFirestoreItems] = useState<(FirestoreProduct & { id: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { convertBotToUsd, convertBotToNgn, formatUsd, formatNgn, isLoading: isCurrencyLoading } = useCurrency();

  const categories = ["All", "Electronics & Tech", "Fashion & Apparel", "Home & Everyday", "Gourmet & Foodstuff", "Collectibles & Art"];

  // User profiles map (sellerWallet -> fullName)
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  // Load real Firestore listings & seller user profiles on mount
  useEffect(() => {
    getProducts()
      .then(async (products) => {
        setFirestoreItems(products);
        setIsLoading(false);

        // Fetch seller profile names from Firestore `users/` collection
        const profilesMap: Record<string, string> = {};
        for (const p of products) {
          if (p.sellerWallet && !profilesMap[p.sellerWallet]) {
            const user = await getUser(p.sellerWallet);
            if (user?.fullName) {
              profilesMap[p.sellerWallet] = user.fullName;
            }
          }
        }
        setUserProfiles(profilesMap);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Map & filter active, available Firestore products
  const mappedFirestoreItems = firestoreItems
    .filter((p) => p.status === "ACTIVE" && (p.quantity === undefined || p.quantity > 0))
    .map((p) => {
      const cleanPrice = Math.abs(Number(p.price) || 0);
      const resolvedName = p.sellerName || userProfiles[p.sellerWallet];
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        priceBot: cleanPrice,
        usdEquivalent: (cleanPrice * 0.5).toFixed(0),
        image: p.images?.[0] || "/placeholder.jpg",
        sellerName: formatUserDisplayName(resolvedName, p.sellerWallet),
        sellerTrustScore: p.trustScore || 90,
        quantity: p.quantity ?? 1,
        specifications: { "Condition": p.condition || "Verified" },
        isFromFirestore: true,
      };
    });

  // Only show real Firestore listings
  const allListings = mappedFirestoreItems;

  const filteredListings = allListings.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="border-b border-white/[0.07] pb-8 mb-8">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-2">
            <span>● P2P COMMERCE CLEARINGHOUSE FLOOR</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">NEW & USED PERSON-TO-PERSON TRADING</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Person-to-Person Marketplace
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-3xl">
            Buy and sell new or used items directly from person to person. From pre-owned electronics and furniture to vintage clothing and artisan foodstuffs, Botrow holds your funds safely in smart contract escrow until you inspect the item and confirm it matches the seller's condition description.
          </p>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-center justify-between bg-[#0E1017] p-3 rounded-lg border border-white/[0.07] shadow-sm">
          {/* Category Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto font-mono text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  selectedCategory === cat
                    ? "bg-white text-zinc-950 font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search used items, tech, foodstuff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Asset Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((item) => {
            const conditionText = item.specifications?.["Condition"] || "Verified Item";
            const isUsed = conditionText.toLowerCase().includes("used") || conditionText.toLowerCase().includes("pre-owned");

            return (
              <Link
                key={item.id}
                href={`/marketplace/${item.id}`}
                className="group flex flex-col bg-[#0B0D13] border border-white/[0.07] rounded-lg overflow-hidden hover:border-white/20 transition-all duration-300 shadow-md"
              >
                {/* Asset Header Info */}
                <div className="p-4 border-b border-white/[0.05] flex items-center justify-between bg-[#0E1018]/60">
                  <span className="text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300 border border-white/10 px-2 py-0.5 rounded tracking-wider">
                    {item.category}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{((item as any).aiAnalysis?.trustScore ?? item.sellerTrustScore ?? 90)}% TRUSTED</span>
                  </div>
                </div>

                {/* Product Image & Condition Badge */}
                <div className="relative h-48 w-full bg-zinc-950 overflow-hidden border-b border-white/[0.05]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0D13] via-transparent to-transparent opacity-60 pointer-events-none" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold backdrop-blur border shadow-sm ${
                      isUsed
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}>
                      {isUsed ? "● PRE-OWNED / USED" : "● BRAND NEW / FRESH"}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold backdrop-blur bg-black/60 text-emerald-400 border border-emerald-500/30">
                      📦 {item.quantity ?? 1} IN STOCK
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors tracking-tight">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.05] flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase font-semibold">PRICE</div>
                      <div className="text-xl font-bold font-mono text-white tabular-nums tracking-tight mt-0.5">
                        {Math.abs(item.priceBot)} <span className="text-emerald-400 font-normal text-sm">BOT</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                        {isCurrencyLoading ? "..." : `≈ ${formatUsd(convertBotToUsd(item.priceBot))} / ${formatNgn(convertBotToNgn(item.priceBot))}`}
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 group-hover:text-zinc-950 group-hover:bg-white transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Footer status */}
                <div className="px-5 py-2.5 bg-zinc-950/80 border-t border-white/[0.04] text-[11px] font-mono text-zinc-500 flex items-center justify-between">
                  <span>SELLER: {item.sellerName.slice(0, 14)} ({item.sellerTrustScore}/100)</span>
                  <span className="text-zinc-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" /> Insured
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {isLoading && (
          <div className="col-span-3 py-20 flex flex-col items-center justify-center">
            <div className="relative">
              <Hexagon className="w-16 h-16 text-emerald-500/20 absolute -inset-2 animate-pulse" strokeWidth={1} />
              <Loader2 className="w-12 h-12 text-emerald-400 animate-spin relative z-10" />
            </div>
            <h2 className="mt-6 text-xl font-bold font-mono text-white tracking-widest uppercase flex items-center gap-2">
              Botrow AI <span className="text-emerald-500 animate-pulse">_</span>
            </h2>
            <p className="mt-2 text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Scanning Marketplace Network
            </p>
          </div>
        )}

        {!isLoading && filteredListings.length === 0 && allListings.length > 0 && (
          <div className="text-center py-20 bg-[#0C0E14] border border-white/[0.07] rounded-lg">
            <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-mono text-zinc-400">No listings match your search or filter.</p>
            <button onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }} className="mt-4 text-xs font-mono text-emerald-400 underline">Clear filters</button>
          </div>
        )}

        {!isLoading && allListings.length === 0 && (
          <div className="text-center py-20 bg-[#0C0E14] border border-white/[0.07] rounded-lg">
            <Cpu className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm font-mono text-zinc-400">No listings yet. Be the first to list an item!</p>
            <Link href="/create" className="mt-4 inline-block text-xs font-mono text-emerald-400 underline">Create a listing →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
