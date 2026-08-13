import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Helper to fetch and convert a URL to base64
async function fetchMediaAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    return {
      mimeType,
      data: buffer.toString("base64"),
    };
  } catch (err) {
    console.error("Error fetching media for AI:", err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const { orderId, chatHistory } = await req.json();

    if (!orderId || !chatHistory || !Array.isArray(chatHistory)) {
      return NextResponse.json({ error: "Missing orderId or chatHistory" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    // 1. Fetch Order Details
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data();

    // 2. Build the System Prompt
    const systemPrompt = `You are the Botrow AI Judge, a decentralized dispute resolution agent for the Botrow escrow protocol. 
Your job is to read the details of an active escrow order and the ongoing dispute chat history between the buyer and seller (including any image/video evidence attached), and provide an impartial, helpful assessment or preliminary ruling.
You must act as a mediator. If there is clear evidence, you can suggest a resolution (e.g., Refund Buyer, or Release to Seller). If you need more evidence, ask the parties for it.
Keep your response concise, professional, and clear.`;

    const orderContextText = `
Order Details:
- Product Title: ${orderData.productTitle || "Unknown"}
- Escrow Amount: ${orderData.amount} BOT
- Buyer Wallet: ${orderData.buyer}
- Seller Wallet: ${orderData.seller}
- Current Status: ${orderData.status}
`;

    // 3. Format Chat History and Process Media
    const contents: any[] = [];
    
    // Add context as the first user message
    contents.push({
      role: "user",
      parts: [{ text: orderContextText }]
    });

    // To prevent hitting memory limits, only process media for the last 5 messages
    const recentMessages = chatHistory.slice(-10);

    for (const msg of recentMessages) {
      const role = msg.senderRole === "AI" ? "model" : "user";
      const parts: any[] = [];
      
      let prefix = "";
      if (msg.senderRole !== "AI") {
         prefix = `[${msg.senderRole} (${msg.senderAddress}) says]: `;
      }

      parts.push({ text: prefix + msg.text });

      // If the message has media, parse data URIs or fetch HTTP URLs
      if (msg.mediaUrls && Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 0) {
        for (const url of msg.mediaUrls) {
          let mimeType = "image/jpeg";
          let base64Data = "";

          if (url.startsWith("data:")) {
            const matches = url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              mimeType = matches[1];
              base64Data = matches[2];
            }
          } else {
            const media = await fetchMediaAsBase64(url);
            if (media) {
              mimeType = media.mimeType;
              base64Data = media.data;
            }
          }

          if (base64Data) {
            parts.push({
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            });
            parts.push({ text: `[Attached Media: ${mimeType}]` });
          }
        }
      }

      contents.push({ role, parts });
    }

    // 4. Query Gemini
    const modelsToTry = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-pro", "gemini-3.6-flash", "gemini-pro-latest"];
    let aiReply: string | null = null;
    let lastError = "Unknown Error";
    
    for (const modelName of modelsToTry) {
      try {
        const googleRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: contents,
              generationConfig: {
                temperature: 0.3,
              },
            }),
          }
        );

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          aiReply = googleData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (aiReply) break;
        } else {
          const errorText = await googleRes.text();
          console.error(`Gemini API Error for ${modelName}:`, googleRes.status, errorText);
          lastError = `${googleRes.status}: ${errorText}`;
        }
      } catch (err: any) {
        console.error(`Failed with ${modelName}:`, err);
        lastError = err.message;
      }
    }

    if (!aiReply) {
      throw new Error(`Failed to communicate with AI Judge. Google API Error: ${lastError}`);
    }

    // 5. Save AI response to chat
    const { addDisputeMessage } = await import("@/lib/firestore");
    await addDisputeMessage(orderId, {
      senderRole: "AI",
      senderAddress: "Botrow AI Judge",
      text: aiReply,
    });

    return NextResponse.json({ success: true, aiReply });

  } catch (error: any) {
    console.error("AI Dispute Chat Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
