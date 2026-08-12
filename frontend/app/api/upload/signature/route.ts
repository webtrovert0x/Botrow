import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const { folder } = await req.json();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const targetFolder = folder || "botrow/disputes";

    const paramsToSign = `folder=${targetFolder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    return NextResponse.json({
      signature,
      timestamp,
      folder: targetFolder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
