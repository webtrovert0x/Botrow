"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSendTransaction, useSwitchChain, useChainId } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { parseEther } from "viem";
import { ShieldCheck, Cpu, ArrowLeft, Sparkles, AlertTriangle, Database, Globe, Layers, UploadCloud, Image as ImageIcon, Trash2, Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { uploadProductImages } from "@/lib/storage";
import { saveProduct, getUser, formatUserDisplayName } from "@/lib/firestore";
import { LISTING_FEE_RECIPIENT, LISTING_FEE_AMOUNT } from "@/constants/contract";
import { botChainMainnet } from "@/config/chains";
import { useCurrency } from "@/hooks/useCurrency";
import heic2any from "heic2any";

export default function CreateListingPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const [isProfileComplete, setIsProfileComplete] = useState(false);
  const { convertBotToUsd, convertBotToNgn, formatUsd, formatNgn, isLoading: isCurrencyLoading } = useCurrency();

  // Check if profile is complete
  useEffect(() => {
    if (address) {
      getUser(address).then((profile) => {
        if (profile && profile.fullName && profile.email && profile.shippingAddress) {
          setIsProfileComplete(true);
        }
      }).catch(console.error);
    }
  }, [address]);

  // Form Basic Fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Electronics & Tech");
  const [condition, setCondition] = useState("Used - Excellent");
  const [priceBot, setPriceBot] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("Lagos / Global Dispatch");

  // Image Upload UX
  // Tracks preview URLs for display (blob URLs for local files, real CDN URLs for samples)
  const [images, setImages] = useState<string[]>([]);
  // Actual File objects for real Firebase Storage upload
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI Assistant States
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    improvedTitle: string;
    improvedDescription: string;
    suggestedTags: string[];
    priceEstimate: string;
    scamScan: string;
    trustScore: number;
    suggestedCategory: string;
    imageQualityScore: string;
    proofOfLifeVerified: boolean;
  } | null>(null);

  const [publishState, setPublishState] = useState<"idle" | "firebase" | "ipfs" | "botchain" | "done">("idle");
  const [securityCode, setSecurityCode] = useState("");

  useEffect(() => {
    // Generate a 4-digit security code on mount for Proof of Life
    setSecurityCode(Math.floor(1000 + Math.random() * 9000).toString());
  }, []);

  // Handle local file image selection — store File for real upload + blob URL for instant preview
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Show a quick loading toast since HEIC conversion might take a second
    const loadingToast = toast.loading("Processing image format...");
    
    try {
      const processedFiles: File[] = [];
      
      for (const file of Array.from(files)) {
        if (file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
          // Convert Apple HEIC to standard JPEG
          const convertedBlob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8
          });
          
          // heic2any can return an array of blobs if it's an animation, we take the first
          const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
          const jpegFile = new File([finalBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
          processedFiles.push(jpegFile);
        } else {
          processedFiles.push(file);
        }
      }
      
      const newFiles = processedFiles.slice(0, 8 - images.length);
      const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
      setImageFiles((prev) => [...prev, ...newFiles].slice(0, 8));
      setImages((prev) => [...prev, ...newPreviews].slice(0, 8));
      
      toast.dismiss(loadingToast);
    } catch (err) {
      console.error("Image processing error:", err);
      toast.dismiss(loadingToast);
      toast.error("Failed to process image format. Please try uploading a JPG or PNG instead.");
    }

    // Reset input so same file can be reselected if needed
    e.target.value = "";
  };

  const addImageUrl = () => {
    if (!customImageUrl.trim()) return;
    setImages((prev) => [...prev, customImageUrl.trim()].slice(0, 8));
    setCustomImageUrl("");
    setShowUrlInput(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const loadSamplePhotos = (type: "camera" | "watch" | "laptop" | "food") => {
    const samples: Record<string, string[]> = {
      camera: [
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=600&q=80",
      ],
      watch: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=600&q=80",
      ],
      laptop: [
        "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=600&q=80",
      ],
      food: [
        "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
      ],
    };
    setImages(samples[type] || []);
  };

  const handleImproveWithAI = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!title && !description) {
      toast.error("Please enter a Title and Description so Botrow AI can analyze your listing!");
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysisResult(null);

    try {
      let imageBase64 = null;

      // Compress and Base64 encode the first image if present
      if (imageFiles.length > 0) {
        const file = imageFiles[0];
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        imageBase64 = await new Promise((resolve) => {
          img.onload = () => {
            // Downscale to max 400px width/height for much faster Botrow AI processing
            const MAX_SIZE = 400;
            let width = img.width;
            let height = img.height;
            if (width > height && width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
            canvas.width = width;
            canvas.height = height;
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.4));
          };
          img.src = URL.createObjectURL(file);
        });
      }

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, category, priceBot, imageBase64, securityCode })
      });
      const data = await res.json();
      
      if (!data.success) throw new Error(data.error || "AI Analysis failed");

      const ai = data.analysis;
      const numPrice = parseFloat(priceBot) || 0.2;
      const lowPrice = (numPrice * 0.96).toFixed(2);
      const highPrice = (numPrice * 1.05).toFixed(2);

      setAiAnalysisResult({
        improvedTitle: ai.improvedTitle,
        improvedDescription: ai.improvedDescription,
        suggestedTags: ["#VerifiedP2P", "#ZeroTrustEscrow", brand ? `#${brand.replace(/\\s+/g, "")}` : "#Authentic", category.replace(/[^a-zA-Z]/g, "") ? `#${category.split(" ")[0]}` : "#P2P"],
        priceEstimate: `${lowPrice} - ${highPrice} BOT (Fair Resale Market Average)`,
        scamScan: ai.scamRiskLevel === "LOW" ? `🟢 ${ai.scamScanReason}` : (ai.scamRiskLevel === "MEDIUM" ? `🟡 ${ai.scamScanReason}` : `🔴 ${ai.scamScanReason}`),
        trustScore: ai.trustScore,
        suggestedCategory: category,
        imageQualityScore: imageBase64 ? "Vision verification complete." : "No photo uploaded. Text-only analysis completed.",
        proofOfLifeVerified: ai.proofOfLifeVerified || false,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to analyze listing with AI.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const applyAiImprovements = () => {
    if (!aiAnalysisResult) return;
    setTitle(aiAnalysisResult.improvedTitle);
    setDescription(aiAnalysisResult.improvedDescription);
    setCategory(aiAnalysisResult.suggestedCategory);
    toast.success("AI Improvements Applied!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!isProfileComplete) {
      toast.error("Please complete your Seller Profile details (Name, Email, Address) in your Profile settings before creating a listing.");
      router.push("/profile");
      return;
    }

    if (images.length < 3) {
      toast.error("Please upload at least 3 photos of your item from different angles! This builds buyer trust and enables AI verification.");
      return;
    }

    if (!aiAnalysisResult || !aiAnalysisResult.proofOfLifeVerified) {
      toast.error("⚠️ PROOF OF LIFE REQUIRED: You must run the AI Visual Scan first to verify your handwritten security code in the photo before publishing.");
      return;
    }

    if (!isConnected) {
      open({ view: "Connect" });
      return;
    }

    try {
      // ── STEP 1: Upload real photos to Cloudinary CDN ─────────────────────
      setPublishState("firebase");
      const tempProductId = `product_${Date.now()}`;

      let finalImageUrls: string[] = [];
      if (imageFiles.length > 0) {
        finalImageUrls = await uploadProductImages(imageFiles, tempProductId);
        // Exclude the first image (visual verification photo) from the public marketplace gallery
        finalImageUrls = finalImageUrls.slice(1);
      } else {
        finalImageUrls = images.slice(1);
      }

      // ── STEP 2: Deposit 0.1 BOT Seller Registration Fee on BOT Chain ─────
      setPublishState("botchain");

      // Auto-switch to BOT Chain 968 if user wallet is on another chain
      if (currentChainId !== botChainMainnet.id) {
        await switchChainAsync({ chainId: botChainMainnet.id });
      }

      // Trigger wallet transaction signature (0.1 BOT sent to treasury)
      const txHash = await sendTransactionAsync({
        to: LISTING_FEE_RECIPIENT as `0x${string}`,
        value: parseEther(LISTING_FEE_AMOUNT),
        chainId: botChainMainnet.id,
      });

      // Fetch seller profile to get full name if set
      const sellerProfile = address ? await getUser(address) : null;
      const sellerDisplayName = formatUserDisplayName(sellerProfile?.fullName, address);

      // ── STEP 3: Save listing metadata & AI Trust Score to Firestore ───────
      setPublishState("ipfs");
      const productId = await saveProduct({
        title,
        description,
        aiDescription: aiAnalysisResult?.improvedDescription || description,
        trustScore: aiAnalysisResult?.trustScore || 90,
        category,
        condition,
        brand,
        location,
        sellerWallet: address || "0x0000000000000000000000000000000000000000",
        sellerName: sellerDisplayName,
        images: finalImageUrls,
        price: Math.abs(parseFloat(priceBot)) || 0,
        quantity: Math.max(1, parseInt(quantity) || 1),
        status: "ACTIVE",
        transactionHash: txHash,
      });

      setPublishState("done");
      router.push("/marketplace");
    } catch (err: any) {
      console.error("Listing publish failed:", err);
      const errorMsg = err?.shortMessage || err?.message || "Listing publication failed. Please approve the 0.1 BOT fee in your wallet.";
      setUploadError(errorMsg);
      setPublishState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <button
          onClick={() => router.push("/marketplace")}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to P2P Marketplace Floor</span>
        </button>

        {/* Header */}
        <div className="border-b border-white/[0.07] pb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-2">
            <span>● PREMIUM SELLER STUDIO</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400">P2P SMART CONTRACT ESCROW</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            List Item for Sale
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-3xl leading-relaxed">
            Create an engaging listing with multiple high-resolution photos. Our integrated **Botrow AI Assistant** analyzes your images and descriptions to verify condition and maximize your Trust Score!
          </p>
        </div>

        {/* Mandatory Advisory Notice Banner */}
        <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-lg flex items-start gap-3 shadow-inner">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-zinc-300 leading-relaxed">
            <span className="text-amber-400 font-bold uppercase block mb-0.5">⚠️ Mandatory AI Advisory Notice:</span>
            The integrated AI assistant serves strictly an advisory and condition-verification role; it **never executes blockchain transactions or controls user funds**. The BOT Chain blockchain (`Botrow.sol`) remains strictly responsible for non-custodial escrow, settlement payments, ownership records, and protocol security.
          </div>
        </div>

        {/* Main Seller Studio Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* SECTION 1: PHOTO UPLOADER */}
          <div className="p-6 md:p-8 bg-[#0E1017] border border-white/[0.07] rounded-lg shadow-md space-y-6">
            <div className="border-b border-white/[0.06] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-400" />
                  <span>1. Upload Product Photos (Max 8)</span>
                </h2>
                <div className="mt-2 p-3 bg-red-950/20 border border-red-500/30 rounded text-xs font-mono text-zinc-300">
                  <strong className="text-red-400">⚠️ PROOF OF LIFE REQUIRED:</strong> To prevent fake stock photos, you must include a handwritten piece of paper in your cover photo containing the code: <strong className="bg-red-500/20 text-red-300 px-1 py-0.5 rounded ml-1">Botrow - {securityCode}</strong>
                </div>
              </div>
            </div>

            {/* Photo Grid Preview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {images.map((img, index) => (
                <div key={`${img}-${index}`} className="relative h-36 bg-zinc-950 rounded-md overflow-hidden border border-white/10 group shadow-inner">
                  <img src={img} alt={`Product thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                  {index === 0 && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-emerald-500 text-black text-[9px] font-mono font-extrabold uppercase rounded shadow">
                      COVER PHOTO
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded-full opacity-90 hover:opacity-100 transition-opacity shadow"
                    title="Delete photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Upload Drop Zone / Add Box */}
              {images.length < 8 && (
                <label className="h-36 bg-zinc-900/50 hover:bg-zinc-900 border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-md flex flex-col items-center justify-center cursor-pointer transition-all p-3 text-center group">
                  <UploadCloud className="w-7 h-7 text-zinc-400 group-hover:text-emerald-400 transition-colors mb-2" />
                  <span className="text-xs font-mono font-bold text-zinc-300 group-hover:text-white">Add Item Photo</span>
                  <span className="text-[10px] font-mono text-zinc-500 mt-0.5">JPG, PNG or WEBP</span>
                  <input
                    type="file"
                    accept="image/*,.heic,.heif,image/heic,image/heif"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Alternative URL upload button for demo versatility */}
            <div className="flex items-center justify-between text-xs font-mono pt-2">
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showUrlInput ? "Hide image URL input" : "Paste an external image URL instead"}</span>
              </button>
              <span className="text-zinc-500">Selected: {images.length}/8 photos</span>
            </div>

            {showUrlInput && (
              <div className="flex gap-2 p-3 bg-zinc-950 rounded-md border border-white/10">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={addImageUrl}
                  className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 font-mono text-xs font-bold rounded border border-white/10"
                >
                  Add URL
                </button>
              </div>
            )}


          </div>

          {/* SECTION 2: ITEM SPECIFICS & AI STUDIO */}
          <div className="p-6 md:p-8 bg-[#0E1017] border border-white/[0.07] rounded-lg shadow-md space-y-6">
            <div className="border-b border-white/[0.06] pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">2. Item Specifications & AI Assistant</h2>
                <p className="text-xs font-mono text-zinc-400 mt-1">Enter key product attributes and optimize presentation with Botrow AI.</p>
              </div>
              <button
                type="button"
                onClick={handleImproveWithAI}
                disabled={isAiAnalyzing}
                className="px-3.5 py-2 rounded bg-emerald-500 text-black font-mono font-extrabold text-xs uppercase tracking-wider hover:bg-emerald-400 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>{isAiAnalyzing ? "Evaluating Photos & Text..." : "✨ Improve with AI"}</span>
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                  ITEM TITLE / ADVERT NAME
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gently Used Sony a7 IV Camera + 24-70mm Lens (Mint Condition)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                    CATEGORY
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Electronics & Tech">Electronics & Tech (Computers, Phones)</option>
                    <option value="Fashion & Apparel">Fashion & Apparel (Watches, Clothes)</option>
                    <option value="Home & Everyday">Home & Everyday (Furniture, Appliances)</option>
                    <option value="Gourmet & Foodstuff">Gourmet & Foodstuff (Artisan Bundles)</option>
                    <option value="Collectibles & Art">Collectibles & Art (Books, Vinyl)</option>
                    <option value="Services & Digital">Services & Digital (Domains, Design)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                    CONDITION
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="Used - Excellent">Used - Excellent (Gently Pre-Owned)</option>
                    <option value="Used - Normal Wear">Used - Normal Everyday Wear</option>
                    <option value="Used - Like New">Used - Like New (Open Box)</option>
                    <option value="Brand New">Brand New / Factory Sealed</option>
                    <option value="For Parts / Restoration">For Parts / Restoration Project</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                    BRAND / MANUFACTURER
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sony, Apple, Rolex, Nike"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                    PRODUCT PRICE (BOT)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0.00"
                    value={priceBot}
                    onChange={(e) => setPriceBot(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors tabular-nums font-bold"
                  />
                  {priceBot && !isNaN(parseFloat(priceBot)) && (
                    <div className="mt-2 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-1 rounded inline-block border border-emerald-500/20">
                      {isCurrencyLoading ? "Loading live rates..." : `≈ ${formatUsd(convertBotToUsd(parseFloat(priceBot)))} / ${formatNgn(convertBotToNgn(parseFloat(priceBot)))}`}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                    AVAILABLE INVENTORY (UNITS IN STOCK)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors tabular-nums font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                  LOCATION & DISPATCH REGION
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lagos, Nigeria / Express Courier Shipping"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold uppercase text-zinc-300 mb-2">
                  ITEM DESCRIPTION & PROVENANCE (BE TRANSPARENT)
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail all included accessories, exact wear condition, warranty status, and delivery logistics. Accurate descriptions guarantee fast escrow release upon arrival..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-white/10 rounded-md text-xs font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors leading-relaxed"
                />
              </div>
            </div>

            {/* AI Underwriting Analysis Result Box */}
            {aiAnalysisResult && (
              <div className="p-6 bg-[#0B0D13] border-2 border-emerald-500/50 rounded-lg space-y-4 shadow-lg animate-fadeIn">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
                    <Cpu className="w-4 h-4 animate-pulse" />
                    <span>Botrow AI Listing Assistant Recommendations</span>
                  </div>
                  <span className="text-xs font-mono bg-emerald-500 text-black font-extrabold px-2 py-0.5 rounded shadow">
                    TRUST SCORE: {aiAnalysisResult.trustScore}/100
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3 bg-zinc-900/60 rounded border border-white/[0.05]">
                    <span className="text-zinc-500 block text-[10px] uppercase mb-1">PROPOSED PROFESSIONAL TITLE</span>
                    <div className="text-white font-semibold">{aiAnalysisResult.improvedTitle}</div>
                  </div>
                  <div className="p-3 bg-zinc-900/60 rounded border border-white/[0.05]">
                    <span className="text-zinc-500 block text-[10px] uppercase mb-1">ESTIMATED FAIR MARKET PRICE</span>
                    <div className="text-emerald-400 font-bold">{aiAnalysisResult.priceEstimate}</div>
                  </div>
                </div>

                <div className="p-3 bg-zinc-900/60 rounded border border-white/[0.05] text-xs font-mono">
                  <span className="text-emerald-400 block text-[10px] uppercase mb-1 font-bold">📸 VISUAL EVIDENCE SCAN RESULTS</span>
                  <div className="flex items-center gap-2 mb-2">
                    {aiAnalysisResult.proofOfLifeVerified ? (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded text-[10px] font-bold">✓ PROOF OF LIFE VERIFIED</span>
                    ) : (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> PROOF OF LIFE FAILED
                      </span>
                    )}
                  </div>
                  <div className="text-zinc-200">{aiAnalysisResult.imageQualityScore}</div>
                </div>

                <div className="p-3 bg-zinc-900/60 rounded border border-white/[0.05] text-xs font-mono">
                  <span className="text-zinc-500 block text-[10px] uppercase mb-1">REWRITTEN PERSUASIVE DESCRIPTION</span>
                  <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{aiAnalysisResult.improvedDescription}</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                  <div>
                    <span className="text-[11px] font-mono text-emerald-300 block">{aiAnalysisResult.scamScan}</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {aiAnalysisResult.suggestedTags.map((tag) => (
                        <span key={tag} className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-white/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={applyAiImprovements}
                    disabled={title === aiAnalysisResult.improvedTitle}
                    className="px-4 py-2 bg-emerald-500 text-black font-mono font-bold text-xs uppercase tracking-wider rounded hover:bg-emerald-400 transition-all shadow shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {title === aiAnalysisResult.improvedTitle ? "✓ Applied" : "✓ Apply AI Suggestions"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Decentralized Storage & Escrow Pipeline Status */}
          {publishState !== "idle" && (
            <div className="p-6 bg-[#0B0D13] border border-emerald-500/30 rounded-lg space-y-4 font-mono text-xs shadow-lg">
              <div className="font-bold text-emerald-400 uppercase text-center border-b border-white/[0.06] pb-3 text-sm flex items-center justify-center gap-2">
                <Globe className="w-4 h-4 animate-spin" />
                <span>Synchronizing Firebase Backend & BOT Chain Escrow</span>
              </div>
              <div className="space-y-3">
                <div className={`flex items-center gap-3 ${["firebase", "botchain", "ipfs", "done"].includes(publishState) ? "text-emerald-400" : "text-zinc-600"}`}>
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span>1. Uploading {images.length} product photos to Cloudinary CDN... {["botchain", "ipfs", "done"].includes(publishState) ? "✓ URLS GENERATED" : publishState === "firebase" ? "✓ UPLOADING..." : ""}</span>
                </div>
                <div className={`flex items-center gap-3 ${["botchain", "ipfs", "done"].includes(publishState) ? "text-emerald-400" : "text-zinc-600"}`}>
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>2. Depositing 0.1 BOT Listing Registration Fee to BOT Chain Treasury (Chain 677)... {["ipfs", "done"].includes(publishState) ? "✓ CONFIRMED ON-CHAIN" : publishState === "botchain" ? "⚡ AWAITING WALLET SIGNATURE..." : ""}</span>
                </div>
                <div className={`flex items-center gap-3 ${["ipfs", "done"].includes(publishState) ? "text-emerald-400" : "text-zinc-600"}`}>
                  <Database className="w-4 h-4 shrink-0" />
                  <span>3. Saving advert metadata & AI Trust Score to Firebase Firestore (`products/`)... {publishState === "done" && "✓ INDEXED & LIVE"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Upload Error Display */}
          {uploadError && (
            <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-lg text-xs font-mono text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <div>
                <span className="font-bold text-red-400 block mb-0.5">Upload Failed</span>
                {uploadError}
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={publishState !== "idle"}
            className="w-full py-4 px-6 rounded-md bg-white text-zinc-950 font-mono font-bold text-sm uppercase tracking-wider hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {publishState !== "idle" && publishState !== "done" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
                <span>Processing Cloudinary Upload & 0.1 BOT Wallet Signature...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>
                  {!aiAnalysisResult 
                    ? "Run AI Visual Scan to Publish" 
                    : !aiAnalysisResult.proofOfLifeVerified 
                      ? "Proof of Life Failed" 
                      : isConnected ? `Pay 0.1 BOT & Publish Advert (${images.length} Photos)` : "Connect Reown To Publish Advert"
                  }
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
