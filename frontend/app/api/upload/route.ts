import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

/**
 * POST /api/upload
 *
 * Accepts a multipart FormData body with:
 *   - file: the image File to upload
 *   - folder: (optional) destination folder in Cloudinary
 *
 * Returns { url, publicId } on success.
 *
 * The API Secret never touches the browser — it lives only here,
 * server-side, and is used to generate a signed Cloudinary upload.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "botrow/products";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Build Cloudinary signed upload parameters
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Cloudinary signature: SHA-1(sorted_params + API_SECRET) — SHA-1 is the default algorithm
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + API_SECRET)
      .digest("hex");

    // Forward the upload to Cloudinary
    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", file);
    cloudinaryForm.append("folder", folder);
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
      console.error("Cloudinary upload error:", data);
      return NextResponse.json(
        { error: data.error?.message || "Cloudinary upload failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.secure_url,       // HTTPS CDN URL — saved directly to Firestore
      publicId: data.public_id,
      width: data.width,
      height: data.height,
    });
  } catch (err: any) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
