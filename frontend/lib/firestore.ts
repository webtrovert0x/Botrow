import { db } from "./firebase";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  DocumentData,
  arrayUnion,
} from "firebase/firestore";
import { encryptPII, decryptPII } from "./encryption";
import CryptoJS from "crypto-js";

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────

export interface FirestoreProduct {
  title: string;
  description: string;
  aiDescription?: string;
  trustScore?: number;
  category: string;
  condition: string;
  brand?: string;
  location?: string;
  sellerWallet: string;
  sellerName?: string;
  images: string[]; // Firebase Storage CDN download URLs
  price: number; // in BOT
  quantity?: number; // Stock inventory count
  status: "ACTIVE" | "LOCKED" | "SETTLED" | "DISPUTED";
  createdAt?: any;
  // Blockchain sync fields — written after escrow deposit
  escrowId?: number;
  contractAddress?: string;
  transactionHash?: string;
}

/**
 * Format a user's display name: Returns their full name if provided, 
 * otherwise returns a clean hashed wallet address (e.g. 0x71C...89E2).
 */
export function formatUserDisplayName(fullName?: string, walletAddress?: string): string {
  if (fullName && fullName.trim().length > 0) {
    return fullName.trim();
  }
  if (walletAddress && walletAddress.startsWith("0x")) {
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }
  return walletAddress || "Anonymous Participant";
}

/**
 * Save a new product listing to Firestore.
 * Returns the generated Firestore document ID.
 */
export async function saveProduct(product: FirestoreProduct): Promise<string> {
  const docRef = await addDoc(collection(db, "products"), {
    ...product,
    status: "ACTIVE",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Fetch all active product listings ordered by creation date (newest first).
 */
export async function getProducts(): Promise<(FirestoreProduct & { id: string })[]> {
  const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as FirestoreProduct),
  }));
}

/**
 * Fetch a single product by its Firestore document ID.
 */
export async function getProduct(id: string): Promise<(FirestoreProduct & { id: string }) | null> {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as FirestoreProduct) };
}

// ─────────────────────────────────────────────
// ORDERS & DELIVERIES
// ─────────────────────────────────────────────

export interface DeliveryInfo {
  recipientName: string;
  phoneNumber: string;
  email?: string;
  shippingAddress: string;
}

export interface FirestoreOrder {
  escrowId: number;
  productId: string;
  productTitle?: string;
  productImage?: string;
  buyer: string;
  seller: string;
  txHash: string;
  contractAddress: string;
  amount: number;
  status: "AWAITING_DELIVERY" | "DELIVERED" | "DISPUTED" | "RESOLVED" | "EXPIRED";
  deliveryInfo?: DeliveryInfo;
  disputeReason?: string;
  aiRuling?: string;
  aiConfidence?: number;
  humanVerified?: boolean;
  messages?: DisputeMessage[];
  createdAt?: any;
}

/**
 * Helper to decrypt PII fields in a DeliveryInfo object
 */
function decryptOrderPII(order: FirestoreOrder): FirestoreOrder {
  if (order.deliveryInfo) {
    return {
      ...order,
      deliveryInfo: {
        ...order.deliveryInfo,
        email: order.deliveryInfo.email ? decryptPII(order.deliveryInfo.email) : undefined,
        phoneNumber: decryptPII(order.deliveryInfo.phoneNumber),
        shippingAddress: decryptPII(order.deliveryInfo.shippingAddress),
      }
    };
  }
  return order;
}

/**
 * Create a new escrow order in Firestore after a successful on-chain deposit.
 * Simultaneously updates the linked product document with blockchain sync metadata.
 */
export async function createOrder(order: FirestoreOrder): Promise<string> {
  // Encrypt delivery info PII
  const encryptedOrder = { ...order };
  if (encryptedOrder.deliveryInfo) {
    encryptedOrder.deliveryInfo = {
      ...encryptedOrder.deliveryInfo,
      email: encryptedOrder.deliveryInfo.email ? encryptPII(encryptedOrder.deliveryInfo.email) : undefined,
      phoneNumber: encryptPII(encryptedOrder.deliveryInfo.phoneNumber),
      shippingAddress: encryptPII(encryptedOrder.deliveryInfo.shippingAddress)
    };
  }

  // 1. Write the order document
  const orderRef = await addDoc(collection(db, "orders"), {
    ...encryptedOrder,
    createdAt: serverTimestamp(),
  });

  // 2. Fetch target product document to update inventory quantity
  const productRef = doc(db, "products", order.productId);
  const productSnap = await getDoc(productRef);

  let newQuantity = 0;
  if (productSnap.exists()) {
    const currentQty = productSnap.data().quantity ?? 1;
    newQuantity = Math.max(0, currentQty - 1);
  }

  // 3. Atomically sync blockchain metadata and updated stock quantity back onto product document
  await updateDoc(productRef, {
    quantity: newQuantity,
    status: newQuantity <= 0 ? "LOCKED" : "ACTIVE",
    escrowId: order.escrowId,
    contractAddress: order.contractAddress,
    transactionHash: order.txHash,
  });

  return orderRef.id;
}

/**
 * Update an existing escrow order's status (e.g., after buyer confirms delivery).
 */
export async function updateOrderStatus(
  orderId: string,
  status: FirestoreOrder["status"]
): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), { status });
}

/**
 * Fetch all orders where the specified wallet is the buyer.
 */
export async function getOrdersByBuyer(buyerWallet: string): Promise<(FirestoreOrder & { id: string })[]> {
  try {
    const q = query(collection(db, "orders"), where("buyer", "==", buyerWallet));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...decryptOrderPII(doc.data() as FirestoreOrder),
    }));
  } catch (err) {
    console.error("Error fetching buyer orders:", err);
    return [];
  }
}

/**
 * Fetch all orders where the specified wallet is the seller.
 */
export async function getOrdersBySeller(sellerWallet: string): Promise<(FirestoreOrder & { id: string })[]> {
  try {
    const q = query(collection(db, "orders"), where("seller", "==", sellerWallet));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...decryptOrderPII(doc.data() as FirestoreOrder),
    }));
  } catch (err) {
    console.error("Error fetching seller orders:", err);
    return [];
  }
}

/**
 * Fetch total count of all orders created/completed on the platform by all users.
 */
export async function getCompletedOrdersCount(): Promise<{ totalOrders: number; completedOrders: number }> {
  try {
    const snapshot = await getDocs(collection(db, "orders"));
    const totalOrders = snapshot.size;
    let completedOrders = 0;
    snapshot.docs.forEach((d) => {
      const status = d.data().status;
      if (status === "DELIVERED" || status === "RESOLVED") {
        completedOrders += 1;
      }
    });
    return { totalOrders, completedOrders };
  } catch (err) {
    console.error("Error fetching completed orders count:", err);
    return { totalOrders: 0, completedOrders: 0 };
  }
}

// ─────────────────────────────────────────────
// USERS & PROFILES
// ─────────────────────────────────────────────

export interface FirestoreUser {
  walletAddress: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  shippingAddress?: string;
  reputation?: number;
  profileImage?: string;
}

/**
 * Fetch a user profile by wallet address.
 */
export async function getUser(walletAddress: string): Promise<FirestoreUser | null> {
  try {
    const snap = await getDoc(doc(db, "users", walletAddress.toLowerCase()));
    if (!snap.exists()) return null;
    
    const data = snap.data() as FirestoreUser;
    if (data.email) data.email = decryptPII(data.email);
    if (data.phoneNumber) data.phoneNumber = decryptPII(data.phoneNumber);
    if (data.shippingAddress) data.shippingAddress = decryptPII(data.shippingAddress);
    
    return data;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

/**
 * Upsert a user profile keyed by wallet address.
 */
export async function upsertUser(user: Partial<FirestoreUser> & { walletAddress: string }): Promise<void> {
  const normalizedWallet = user.walletAddress.toLowerCase();
  
  // Encrypt PII fields
  const encryptedUser = { ...user };
  let emailHash = null;

  if (user.email) {
    const normalizedEmail = user.email.toLowerCase().trim();
    // Use SHA256 to create a deterministic hash for unique querying
    emailHash = CryptoJS.SHA256(normalizedEmail).toString();
    
    // Check if email hash already exists for a DIFFERENT wallet
    const q = query(collection(db, "users"), where("emailHash", "==", emailHash));
    const querySnapshot = await getDocs(q);
    
    for (const docSnapshot of querySnapshot.docs) {
      if (docSnapshot.id !== normalizedWallet) {
        throw new Error("This email is already registered to another wallet.");
      }
    }
    
    encryptedUser.email = encryptPII(user.email);
  }

  if (encryptedUser.phoneNumber) encryptedUser.phoneNumber = encryptPII(encryptedUser.phoneNumber);
  if (encryptedUser.shippingAddress) encryptedUser.shippingAddress = encryptPII(encryptedUser.shippingAddress);

  const payload: any = {
    ...encryptedUser,
    walletAddress: normalizedWallet,
    updatedAt: serverTimestamp(),
  };

  if (emailHash) {
    payload.emailHash = emailHash;
  }

  await setDoc(doc(db, "users", normalizedWallet), payload, { merge: true });
}

/**
 * Dynamically calculate a seller's Trust Score based on on-chain / marketplace history.
 */
export async function calculateSellerTrustScore(walletAddress: string): Promise<number> {
  let score = 50; // Base score for everyone

  try {
    // 1. Profile Completion Boost
    const profile = await getUser(walletAddress);
    if (profile) {
      if (profile.fullName && profile.email && profile.shippingAddress) {
        score += 10;
      }
    }

    // 2. Order History Impact
    const sellerOrders = await getOrdersBySeller(walletAddress);
    
    for (const order of sellerOrders) {
      if (order.status === "DELIVERED" || order.status === "RESOLVED") {
        score += 10;
      } else if (order.status === "DISPUTED") {
        score -= 20;
      }
    }

    // 3. Clamp between 0 and 100
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    return score;
  } catch (err) {
    console.error("Error calculating trust score:", err);
    return 50; // Fallback to base score on error
  }
}

// ─────────────────────────────────────────────
// DISPUTE CHAT
// ─────────────────────────────────────────────

export interface DisputeMessage {
  id?: string;
  senderRole: "BUYER" | "SELLER" | "ADMIN" | "AI";
  senderAddress: string;
  text: string;
  mediaUrls?: string[]; // Array of Cloudinary CDN URLs
  createdAt?: any;
}

/**
 * Add a new message to an order's messages array (bypasses subcollection rule limits).
 */
export async function addDisputeMessage(orderId: string, message: Omit<DisputeMessage, "id" | "createdAt">): Promise<string> {
  const messageId = Math.random().toString(36).substring(2, 15);
  const fullMessage = {
    ...message,
    id: messageId,
    createdAt: new Date().toISOString(), // Use string to safely store in array
  };
  
  await updateDoc(doc(db, "orders", orderId), {
    messages: arrayUnion(fullMessage)
  });
  
  return messageId;
}
