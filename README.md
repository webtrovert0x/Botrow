<div align="center">
  <img src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop" width="100%" alt="Botrow Header Image" style="border-radius: 12px; margin-bottom: 20px;">
  
  <h1>🤖 Botrow</h1>
  <p><strong>Autonomous Zero-Trust Escrow & Clearinghouse Protocol on BOT Chain</strong></p>

  <p>
    <a href="#-about-the-project">About</a> •
    <a href="#-key-features">Features</a> •
    <a href="#-architecture--tech-stack">Architecture</a> •
    <a href="#-smart-contract-engine">Smart Contracts</a> •
    <a href="#-getting-started">Quickstart</a>
  </p>
</div>

---

## 🏆 About The Project

**Botrow** is a next-generation peer-to-peer decentralized escrow commerce platform built exclusively for the **2026 Botchain Hackathon**. 

It leverages **BOT Chain** smart contracts for zero-trust financial locking, a dynamic **Fiat-to-Crypto Gateway**, and an innovative decentralized **AI Scam Verification Agent** (powered by Gemini) to completely eliminate the need for human dispute resolution in digital and physical transactions.

We've successfully migrated to the **BOT Chain Mainnet (Chain 677)**, bringing a production-ready, frictionless Web3 commerce experience to the ecosystem.

---

## ✨ Key Features

### 1. Zero-Trust Smart Contract Escrow
- **Trustless Transactions**: Buyers lock native BOT tokens into a non-custodial smart contract instead of sending them directly to a seller.
- **Automated Settlement**: Funds are only released when the buyer cryptographically confirms delivery.
- **7-Day Timeout**: Prevents indefinite fund freezing. If a buyer fails to confirm receipt or open a dispute within 7 days, sellers can release the payout directly.

### 2. Live Fiat-to-Crypto On-Ramp & Off-Ramp
- **Paystack Integration**: Built-in fiat gateway allows users to buy BOT directly with local currencies (e.g., NGN/USD) via bank transfer or card.
- **Server-Side Security**: Token disbursements are calculated securely on a Next.js backend using live API exchange rates, preventing frontend manipulation.
- **Idempotent Webhooks**: Double-spend and replay attacks are prevented using Firestore transaction locks.

### 3. AI-Powered Dispute Resolution & Underwriting
- **Botrow AI Agent**: In the event of a dispute, an autonomous AI Agent reviews chat logs, transaction metadata, and visual proof-of-life evidence.
- **Intelligent Ruling**: The AI executes refunds or forces settlements by cryptographically interacting with the protocol, replacing traditional human customer support teams.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React, TailwindCSS |
| **Web3 / Blockchain** | Viem, Wagmi, Reown AppKit, BOT Chain Mainnet |
| **Smart Contracts** | Solidity, Foundry, OpenZeppelin v5.7.0 |
| **Backend & API** | Next.js Serverless Routes, Nodemailer |
| **Database / State** | Firebase Firestore (Real-time syncing) |
| **AI / Machine Learning** | Google Gemini (Vision & Text Models) |

---

## ⚙️ Smart Contract Engine

An award-winning, production-grade decentralized escrow smart contract tailored for **BOT Chain**. Engineered with zero-trust cryptographic guarantees, real-time indexer events, and property-based fuzzing verification.

* **Verified Mainnet Address:** [`0x64aa9C9FFded25b5DF458689e6fE48980AC4D2b8`](https://scan.botchain.ai/address/0x64aa9c9ffded25b5df458689e6fe48980ac4d2b8)
* **Network:** BOT Chain Mainnet (ID: 677) | RPC: `https://rpc.botchain.ai`

### Gas Efficiency Benchmark

Our contract replaces standard string revert messages with custom native errors (`ZeroAddress`, `InvalidAmount`, `UnauthorizedCaller`) to substantially reduce deployment and runtime transaction gas overhead on BOT Chain.

| Contract Function | Execution Gas Cost (μ Average) | Optimization Status |
| :--- | :--- | :--- |
| **`createEscrow()`** | **358,311 gas** | ✅ High Efficiency (Native Custom Errors) |
| **`confirmDelivery()`** | **429,409 gas** | ✅ Optimized 99%/1% Split Disbursement |
| **`claimExpiredEscrow()`** | **425,555 gas** | ✅ Safe Time-Travel Settlement |
| **`openDispute()` / `resolve`** | **435,166 gas** | ✅ Complete State Resolution |

---

## 🚀 Getting Started

Follow these steps to run the Botrow application locally.

### Prerequisites
- Node.js 18+
- Foundry (for smart contract testing)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/botrow-marketplace.git
cd botrow-marketplace/frontend
npm install
```

### 2. Environment Variables
Create a `.env.local` file in the `frontend/` directory with the following variables:

```env
# Web3 Auth
NEXT_PUBLIC_PROJECT_ID=your_reown_project_id
NEXT_PUBLIC_TREASURY_ADDRESS=0xYourTreasuryWalletAddress

# Paystack Gateway (Testnet or Live)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...

# Admin & Faucet
FAUCET_PRIVATE_KEY=0xYourAdminPrivateKey

# Botrow AI Agent
GEMINI_API_KEY=AIzaSy...

# Firebase Services
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# Nodemailer / SMTP
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 3. Start the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000` to interact with the dApp.

---

<div align="center">
  <p><i>Built with ❤️ for the BOT Chain Ecosystem.</i></p>
</div>
