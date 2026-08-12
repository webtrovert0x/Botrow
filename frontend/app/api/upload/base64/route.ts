import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const { file, folder } = await req.json();

    if (!file || !file.startsWith("data:")) {
      return NextResponse.json({ error: "Invalid base64 file data" }, { status: 400 });
    }

    const targetFolder = folder || "botrow/disputes";
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const paramsToSign = `folder=${targetFolder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", file); // Cloudinary accepts Base64 data URIs directly
    cloudinaryForm.append("folder", targetFolder);
    cloudinaryForm.append("api_key", API_KEY);
    cloudinaryForm.append("timestamp", timestamp);
    cloudinaryForm.append("signature", signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
      {
        method: "POST",
        body: cloudinaryForm,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Cloudinary base64 upload error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Cloudinary upload failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: data.secure_url });
  } catch (err: any) {
    console.error("Base64 upload route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
