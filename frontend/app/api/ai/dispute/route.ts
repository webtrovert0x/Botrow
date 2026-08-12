import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req: Request) {
  try {
    const { orderId, disputeReason, buyerAddress } = await req.json();

    if (!orderId || !disputeReason || !buyerAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    // 1. Fetch the Order from Firestore
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data();

    // Verify buyer owns this order
    if (orderData.buyer.toLowerCase() !== buyerAddress.toLowerCase()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 2. Query Gemini to act as the AI Judge
    const systemPrompt = `You are the Botrow AI Judge, a decentralized dispute resolution agent for the Botrow escrow protocol. 
Your job is to read the details of an active escrow order and the buyer's dispute reason, and generate a preliminary ruling.
You must return a raw JSON object (without markdown code blocks) with the following structure:
{
  "ruling": "string (either 'Refund Buyer' or 'Release to Seller')",
  "reasoning": "string (A professional, impartial 2-3 sentence explanation of your decision based on the evidence provided)",
  "confidence": number (1-100 representing how confident you are in this ruling)
}`;

    const promptText = `
Order Details:
- Product Title: ${orderData.productTitle || "Unknown"}
- Escrow Amount: ${orderData.amount} BOT
- Buyer Wallet: ${orderData.buyer}
- Seller Wallet: ${orderData.seller}
- Current Status: ${orderData.status}

Buyer's Dispute Claim:
"${disputeReason}"

Based on this information, issue a preliminary ruling.`;

    const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash"];
    let aiRulingData = null;
    
    for (const modelName of modelsToTry) {
      try {
        const googleRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.2,
              },
            }),
          }
        );

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          let aiReplyRaw = googleData?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (aiReplyRaw) {
            // Strip markdown code blocks if the model accidentally includes them
            aiReplyRaw = aiReplyRaw.replace(/```json/gi, "").replace(/```/g, "").trim();
            aiRulingData = JSON.parse(aiReplyRaw);
            break; // Stop trying if successful
          }
        } else {
          const errorText = await googleRes.text();
          console.error(`Gemini API Error for ${modelName}:`, googleRes.status, errorText);
        }
      } catch (err) {
        console.error(`Failed with ${modelName}:`, err);
      }
    }

    if (!aiRulingData) {
      throw new Error("Failed to communicate with AI Judge or parse ruling across all available models");
    }

    // 3. Update the Order in Firestore
    await updateDoc(orderRef, {
      status: "DISPUTED",
      disputeReason,
      aiRuling: aiRulingData.reasoning,
      aiConfidence: aiRulingData.confidence,
      humanVerified: false,
      updatedAt: serverTimestamp(),
    });

    // 4. Ping the Email Service (Non-blocking)
    const host = req.headers.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
    fetch(`${protocol}://${host}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "dispute_opened",
        buyerAddress: orderData.buyer,
        sellerAddress: orderData.seller,
        productTitle: orderData.productTitle,
        amount: orderData.amount,
        disputeReason: disputeReason
      })
    }).catch(err => console.error("Failed to trigger dispute email:", err));

    return NextResponse.json({
      success: true,
      ruling: aiRulingData
    });

  } catch (error) {
    console.error("AI Dispute Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
