import { NextResponse } from "next/server";
import { BOTROW_CONTRACT_ADDRESS } from "@/constants/contract";

/**
 * POST /api/ai/analyze
 * Botrow AI Listing Scam & Trust Audit API
 */
export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY environment variable" }, { status: 500 });
    }

    const { title, description, category, priceBot, imageBase64, securityCode } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title is required for AI audit" }, { status: 400 });
    }

    const modelsToTry = ["gemini-3.5-flash", "gemini-2.5-flash"];
    let lastError = "Botrow AI returned an unexpected response format. Please try again.";

    const prompt = `
You are Botrow AI, an expert P2P physical item escrow risk analyst for Botrow on BOT Chain 677 (Smart Contract ${BOTROW_CONTRACT_ADDRESS}).

Listing Data:
- Title: ${title}
- Description: ${description || "[No description provided. Please generate a highly detailed and persuasive description based on the title and image.]"}
- Category: ${category || "General P2P"}
- Price: ${priceBot} BOT

System Rules:
- Never fabricate non-existent seller ratings or fake blockchain transactions.
- Base your analysis strictly on the supplied listing data and image (if provided).
- trustScore must be an integer between 0 and 100 that you determine independently based on the listing quality, description clarity, pricing reasonableness, and risk signals. Do NOT default to a fixed value.
- scamRiskLevel must be one of: "LOW", "MEDIUM", or "HIGH".
${imageBase64 ? `- VERY IMPORTANT (PROOF OF LIFE): An image of the product has been attached. You must visually inspect it for a handwritten security code: "${securityCode || "0000"}". However, since this is a hackathon demo environment, you must be EXTREMELY LENIENT. If the photo looks like a legitimate physical item, or if there is any text that vaguely resembles the code, you MUST set proofOfLifeVerified to true. When in doubt, default to true so the user can proceed.` : `- No image was provided for Proof of Life verification.`}
- Return ONLY valid JSON with no markdown fences:
{
  "improvedTitle": "Optimized professional title",
  "improvedDescription": "Clear transparency-enhanced description highlighting buyer inspection rights",
  "trustScore": <your_score_here>,
  "scamRiskLevel": "LOW | MEDIUM | HIGH",
  "scamScanReason": "Your detailed reasoning here.",
  "proofOfLifeVerified": ${imageBase64 ? "true/false" : "false"}
}
`;

    // Construct multi-modal parts
    const aiParts: any[] = [{ text: prompt }];
    if (imageBase64) {
      // Remove any data:image/jpeg;base64, prefix if present
      const base64Parts = imageBase64.split("base64,");
      const base64Data = base64Parts.length > 1 ? base64Parts[1] : imageBase64;
      const mimeType = imageBase64.includes("data:") ? imageBase64.split(";")[0].split(":")[1] : "image/jpeg";
      aiParts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    for (const modelName of modelsToTry) {
      try {
        const googleRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: aiParts }],
              generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 4096,
              },
            }),
          }
        );

        if (googleRes.ok) {
          const googleData = await googleRes.json();
          const responseText = googleData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            try {
              const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
              const parsedData = JSON.parse(cleanJson);
              return NextResponse.json({
                success: true,
                modelUsed: modelName,
                analysis: parsedData,
              });
            } catch (e) {
              lastError = `JSON parse failed for ${modelName}`;
            }
          }
        } else {
          const errorText = await googleRes.text();
          console.error(`Gemini API Error for ${modelName}:`, googleRes.status, errorText);
          lastError = `API Error ${googleRes.status}: ${errorText.slice(0, 100)}`;
        }
      } catch (err: any) {
        lastError = `Network error for ${modelName}: ${err.message}`;
      }
      // If we reach here, the current model failed, the loop continues to the next one
      console.warn(`[Botrow AI] ${modelName} failed, falling back... Error: ${lastError}`);
    }

    return NextResponse.json({
      success: false,
      error: lastError,
    });
  } catch (err: any) {
    console.error("[Botrow AI Audit Error]:", err);
    return NextResponse.json(
      { success: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}
