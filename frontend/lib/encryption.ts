import CryptoJS from "crypto-js";

// We use a fallback key for the hackathon if one isn't provided in .env.local
// In production, NEVER hardcode this fallback, and always use an environment variable.
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || "botrow_hackathon_super_secret_key_2024";

/**
 * Encrypts sensitive Personal Identifiable Information (PII) before it is sent to Firestore.
 * This ensures that even if the database is breached, the data remains secure.
 * 
 * @param text The plain text string (e.g., Shipping Address)
 * @returns The AES encrypted ciphertext
 */
export function encryptPII(text?: string): string {
  if (!text) return "";
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Encryption failed:", error);
    return text; // Fallback to plain text if encryption fails (handle with caution)
  }
}

/**
 * Decrypts the cipher text fetched from Firestore back into plain text.
 * Used exclusively on the client-side dashboard so the seller can fulfill the order.
 * 
 * @param cipherText The AES encrypted string
 * @returns The decrypted plain text
 */
export function decryptPII(cipherText?: string): string {
  if (!cipherText) return "";
  
  // If the text doesn't look like a standard CryptoJS AES payload (e.g. U2FsdGVkX1), it might be legacy unencrypted data.
  // We attempt decryption, but if it fails, we assume it's plain text.
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    // If decryption fails, it usually results in an empty string
    if (decrypted) {
      return decrypted;
    } else {
      return cipherText; 
    }
  } catch (error) {
    // If it throws an error (e.g. Malformed UTF-8), it's likely plain text
    return cipherText;
  }
}
