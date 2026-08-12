# 🤖 Botrow Architecture Specification
**Universal Person-to-Person (P2P) Commerce & AI-Underwritten Clearinghouse**
**Network:** BOT Chain Testnet (Chain ID: 968 | RPC: `https://rpc.bohr.life`)  
**Smart Contract Address:** `0xc73306D7154Bf41bB6c7B6ee4Cc176c864fC681b`

---

## 📐 High-Level System Architecture

```text
                    BOT Chain (Chain ID: 968)
                        │
             Smart Contract (`Botrow.sol`)
                        │
                        │ Contract Address / Tx Hash / Escrow ID
                        ▼
Next.js Frontend ───────────── Google Firebase
        │                         │
        │                         ├── Firestore (Products, Orders, Users, AI Metadata)
        │                         ├── Storage (Multi-photo Image Galleries)
        │                         ├── Auth (Optional Web3 JWT & Email Verification)
        │                         └── Extensions (Trigger Email Notifications)
        │
        ├── Reown AppKit (Wallet Connectivity)
        ├── Google Gemini AI (Underwriting & Advisory via Server-Side API Routes)
        └── Wagmi / Viem (EVM Contract Execution)
```

---

## ⚖️ Division of Storage: On-Chain vs. Off-Chain

### 1. What Goes On-Chain? (`Botrow.sol` on BOT Chain)
To preserve ultra-low gas costs and sub-cent settlement fees, **only data that benefits directly from decentralized cryptographic trust and fund immutability** is written to Solidity state:
* `escrowId` (Unique integer identifier)
* `onchainListingId` (Lightweight 32-byte string linking to Firestore advert)
* `buyer` & `seller` wallet addresses (`0x...`)
* `amount` (Deposit total in BOT tokens) & `protocolFee`
* `createdAt` & `expiresAt` timestamps (7-day automated timeout claim fallback)
* `status` (Enum: `AWAITING_DELIVERY`, `DELIVERED`, `DISPUTED`, `RESOLVED`, `EXPIRED_RELEASED`)
* Transaction & block receipts (`txHash`)

### 2. What Stays in Firebase? (Serverless Cloud Backend)
**Everything else.** Storing heavy image files, item descriptions, product categories, and voluminous AI diagnostic reports directly on-chain is computationally abusive and would cost thousands of dollars in gas. Those strictly live in **Google Firebase**.

#### 🔥 Cloud Firestore Collections
```text
products
    productId
        title: string
        description: string
        aiDescription: string
        trustScore: number (0-100)
        category: string ("Electronics & Tech", "Fashion & Apparel", "Home", etc.)
        sellerWallet: string ("0x...")
        images: string[] (Firebase Storage Download URLs)
        price: number (BOT)
        status: string ("ACTIVE", "LOCKED", "SETTLED")
        createdAt: timestamp
        // Blockchain sync metadata when escrow starts:
        escrowId: number
        contractAddress: string
        transactionHash: string

orders
    orderId
        escrowId: number
        productId: string
        buyer: string ("0x...")
        seller: string ("0x...")
        txHash: string
        status: string ("AWAITING_DELIVERY", "DELIVERED", "DISPUTED")

users
    walletAddress
        username: string
        reputation: number
        profileImage: string

reports
    reportId
        escrowId: number
        reason: string
        aiScamAnalysis: string
```

#### 📁 Firebase Cloud Storage
```text
images/
    product1/
        cover_image.jpg
        angle2.jpg
        packaging_serial.webp
```
*Note: Firestore records only the fast CDN download URLs, delivering 60 FPS item discovery across the clearinghouse floor.*

---

## 🔄 The P2P Escrow Lifecycle Flow

```text
Seller creates listing & sets item condition (Brand New / Pre-Owned)
     │
     ▼
Upload multi-photo visual gallery to Firebase Cloud Storage (`images/product/`)
     │
     ▼
Receive public CDN image download URLs
     │
     ▼
Click "✨ Improve with AI" → Gemini analyzes photos & text to generate Trust Score & fair price
     │
     ▼
Save complete advert metadata and AI report to Firestore (`products/`)
     │
     ▼
Buyer discovers item, inspects 6-Point AI Trust Report & clicks "Initialize Escrow"
     │
     ▼
Deploy on-chain Wagmi transaction calling `createEscrow("ITEM_ID", sellerAddress)` on BOT Chain
     │
     ▼
Smart contract (`Botrow.sol`) locks BOT tokens & returns unique `escrowId` receipt
     │
     ▼
Atomically update Firestore order document:
{
  "escrowId": 101,
  "contractAddress": "0xc73306D7154Bf41bB6c7B6ee4Cc176c864fC681b",
  "transactionHash": "0x7a8b...9c3f",
  "status": "AWAITING_DELIVERY"
}
     │
     ▼
Firebase Trigger Email Extension fires notification to seller: "Tokens locked! Dispatch item."
     │
     ▼
Buyer receives physical goods, verifies condition & clicks "Confirm Delivery"
     │
     ▼
Smart contract instantly transfers 99% BOT tokens to seller payout wallet (1% protocol treasury)
```

---

## 🛡️ Mandatory AI Advisory & Security Protocol
1. **Advisory Role Only:** Google Gemini AI is restricted purely to analytical underwriting, scam word detection, copywriting optimization, and diagnostic guidance.
2. **Zero Fund Control:** To protect against prompt injection exploits or hallucination vulnerabilities, **the AI never executes blockchain transactions or controls private keys/funds**. The OpenZeppelin `ReentrancyGuard` smart contract on BOT Chain remains solely responsible for fund custody, escrow locking, and payment release.
3. **Server-Side Key Protection:** All invocations to the Gemini AI models are routed exclusively through Next.js API route handlers (`/api/ai`), ensuring that proprietary API keys and scoring prompts are never exposed to browser client code.
