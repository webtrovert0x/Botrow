import { NextRequest, NextResponse } from "next/server";
import { addDisputeMessage } from "@/lib/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, payload } = body;

    if (!orderId || !payload) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const messageId = await addDisputeMessage(orderId, payload);

    return NextResponse.json({ success: true, messageId });
  } catch (error: any) {
    console.error("Server-side send message error:", error);
    return NextResponse.json({ error: error.message || "Failed to send message" }, { status: 500 });
  }
}
