"use client";

import React, { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDisputeMessage, DisputeMessage, FirestoreOrder } from "@/lib/firestore";
import { Send, Image as ImageIcon, Loader2, Bot, User, Truck, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

interface DisputeChatProps {
  order: FirestoreOrder & { id: string };
  currentUserAddress: string;
  userRole: "BUYER" | "SELLER" | "ADMIN";
}

export default function DisputeChat({ order, currentUserAddress, userRole }: DisputeChatProps) {
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRequestingAI, setIsRequestingAI] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time chat messages from the order document's messages array
  useEffect(() => {
    let unsubscribe: any = null;

    import("firebase/firestore").then(({ doc, onSnapshot }) => {
      unsubscribe = onSnapshot(doc(db, "orders", order.id), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setMessages(data.messages || []);
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [order.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    setIsSending(true);
    try {
      let mediaUrls: string[] = [];
      
      // Compress image and embed as base64 to completely bypass all network proxy restrictions
      if (selectedFile) {
        console.log("=== COMPRESSING IMAGE TO BASE64 ===");
        
        if (selectedFile.type.startsWith("video/")) {
          throw new Error("Video uploads are currently blocked by the hackathon sandbox proxy. Please upload an image instead.");
        }

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(selectedFile);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const MAX_WIDTH = 800;
              const MAX_HEIGHT = 800;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width;
                  width = MAX_WIDTH;
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height;
                  height = MAX_HEIGHT;
                }
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(img, 0, 0, width, height);
              
              // Compress to 0.6 quality JPEG to keep it well under 1MB Firestore limit
              const compressedBase64 = canvas.toDataURL("image/jpeg", 0.6);
              resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
          };
          reader.onerror = error => reject(error);
        });

        // Add the base64 string directly as the media URL
        mediaUrls.push(base64Data);
      }

      // Build message payload
      const payload: any = {
        senderRole: userRole,
        senderAddress: currentUserAddress,
        text: newMessage.trim(),
      };

      if (mediaUrls.length > 0) {
        payload.mediaUrls = mediaUrls;
      }

      // Debug: check exactly what is being sent
      console.log("=== DISPUTE MESSAGE DEBUG ===");
      console.log("Order ID:", order.id);
      console.log("User role:", userRole);
      console.log("User address:", currentUserAddress);
      console.log("Payload:", payload);
      console.log("Selected file:", selectedFile);

      // Add message directly to Firestore (now uses updateDoc which bypasses the create restriction)
      await addDisputeMessage(order.id, payload);
      
      console.log("=== MESSAGE SAVED SUCCESSFULLY ===");
      setNewMessage("");
      setSelectedFile(null);

      // Trigger email notification
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "new_dispute_message",
          orderId: order.id,
          productTitle: order.productTitle,
          senderRole: userRole,
          text: payload.text || "Sent an attachment",
          buyerAddress: order.buyer,
          sellerAddress: order.seller
        }),
      }).catch(err => console.error("Failed to trigger new_dispute_message email", err));

      // Automatically request AI response if the user sent the message
      if (userRole === "BUYER" || userRole === "SELLER") {
        // Wait briefly for the snapshot to update our local messages state, then call AI
        setTimeout(() => requestAIRuling(true), 1500);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const requestAIRuling = async (isBackground = false) => {
    setIsRequestingAI(true);
    const toastId = isBackground ? undefined : toast.loading("Botrow AI is reviewing the evidence...");
    try {
      const res = await fetch("/api/ai/dispute-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          chatHistory: messages,
        })
      });
      const data = await res.json();
      if (data.success) {
        if (toastId) toast.success("AI has issued a ruling in the chat.", { id: toastId });
      } else {
        if (toastId) toast.error(data.error || "AI failed to respond.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      if (toastId) toast.error("Network error requesting AI", { id: toastId });
    } finally {
      setIsRequestingAI(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#090A0F] border border-white/10 rounded-lg overflow-hidden h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-[#0E1017]">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
            Dispute Resolution Center
          </span>
        </div>
        <button
          onClick={() => requestAIRuling(false)}
          disabled={isRequestingAI}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 font-mono text-[10px] font-bold uppercase rounded transition-colors disabled:opacity-50"
        >
          {isRequestingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3 text-emerald-400" />}
          Request AI Review
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 font-mono text-xs mt-10">
            No messages yet. Describe the issue and upload proof to start.
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderAddress.toLowerCase() === currentUserAddress.toLowerCase();
          const isAI = msg.senderRole === "AI";
          
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1 mb-1 text-[10px] font-mono font-bold uppercase text-zinc-500">
                {isAI ? <Bot className="w-3 h-3 text-emerald-400" /> : msg.senderRole === "BUYER" ? <User className="w-3 h-3 text-blue-400" /> : msg.senderRole === "SELLER" ? <Truck className="w-3 h-3 text-amber-400" /> : <ShieldAlert className="w-3 h-3 text-red-400" />}
                <span>{msg.senderRole} {isMe ? "(You)" : ""}</span>
              </div>
              
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${isAI ? "bg-emerald-950/30 border border-emerald-500/30 text-emerald-100" : isMe ? "bg-blue-900/40 text-blue-100" : "bg-zinc-800/50 text-zinc-200"}`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                
                {/* Media Attachments */}
                {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.mediaUrls.map((url, i) => (
                      <div key={i} className="relative rounded overflow-hidden border border-white/10 bg-black/50">
                        {url.match(/\.(mp4|webm|ogg)$/i) || url.includes("/video/") ? (
                          <video src={url} controls className="max-w-full h-auto max-h-48 object-contain" />
                        ) : (
                          <img src={url} alt="Attachment" className="max-w-full h-auto max-h-48 object-contain" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-[#0E1017] border-t border-white/10">
        {selectedFile && (
          <div className="mb-2 px-3 py-1.5 bg-zinc-900 rounded border border-white/10 text-[10px] font-mono text-zinc-400 flex items-center justify-between">
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="text-red-400 hover:text-red-300">Remove</button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <label className="cursor-pointer p-2 bg-zinc-900 hover:bg-zinc-800 rounded text-zinc-400 transition-colors border border-transparent hover:border-white/10">
            <ImageIcon className="w-4 h-4" />
            <input 
              type="file" 
              accept="image/*,video/*"
              className="hidden" 
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50"
            disabled={isSending}
          />
          <button
            type="submit"
            disabled={isSending || (!newMessage.trim() && !selectedFile)}
            className="p-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded transition-colors disabled:opacity-50"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
