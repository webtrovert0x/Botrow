/**
 * lib/storage.ts
 *
 * Uploads product images directly from the browser to Cloudinary
 * using an UNSIGNED upload preset (no API Secret needed client-side).
 *
 * Architecture:
 *   Browser File → POST to Cloudinary API (unsigned preset) → CDN URL
 *   CDN URL → saved in Firestore products.images[]
 */

const CLOUD_NAME = "duyfothnh";
const UPLOAD_PRESET = "botrow_uploads"; // Unsigned preset created in Cloudinary Console

/**
 * Upload a single product image directly to Cloudinary.
 * Returns the permanent HTTPS CDN URL.
 */
export async function uploadProductImage(
  file: File,
  productId: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", `botrow/products/${productId}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Cloudinary upload failed (${response.status})`
    );
  }

  const data = await response.json();
  return data.secure_url as string;
}

/**
 * Upload multiple product images in parallel and return all CDN URLs.
 * The first URL in the returned array is designated as the cover photo.
 */
export async function uploadProductImages(
  files: File[],
  productId: string
): Promise<string[]> {
  const uploadPromises = files.map((file) =>
    uploadProductImage(file, productId)
  );
  const urls = await Promise.all(uploadPromises);
  return urls;
}
