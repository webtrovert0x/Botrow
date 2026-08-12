export type EscrowStatus = "ACTIVE" | "LOCKED" | "DELIVERED" | "REFUNDED" | "CANCELLED";

export type ScamRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AIAnalysis {
  trustScore: number;          // 0 - 100
  riskLevel: ScamRiskLevel;
  priceEstimateBot: number;
  scamWarningReason?: string;
  suggestedTags: string[];
  isVerifiedByBotrowAI: boolean;
  optimizedTitle?: string;
  professionalDescription?: string;
}

export interface Product {
  id: string;
  onchainListingId?: number;
  title: string;
  description: string;
  priceBot: number;
  usdEquivalent: number;
  quantity?: number;
  category: string;
  image: string;
  sellerAddress: string;
  sellerName: string;
  sellerAvatar: string;
  sellerTrustScore: number;
  status: EscrowStatus;
  createdAt: string;
  aiAnalysis: AIAnalysis;
  specifications?: Record<string, string>;
}

export interface Order {
  id: string;
  onchainOrderId: number;
  product: Product;
  buyerAddress: string;
  sellerAddress: string;
  amountBot: number;
  status: EscrowStatus;
  timestamp: string;
  deliveryConfirmedAt?: string;
}

export interface UserProfile {
  walletAddress: string;
  username: string;
  avatarUrl: string;
  aiTrustScore: number;
  totalSales: number;
  totalPurchases: number;
  activeEscrowBalanceBot: number;
  totalRevenueBot: number;
  joinDate: string;
  verifiedBadge: boolean;
}
