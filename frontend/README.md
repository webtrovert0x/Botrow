# Botrow 🤖💼

> **Autonomous Zero-Trust Escrow & Clearinghouse Protocol on BOT Chain**

Botrow is a next-generation peer-to-peer decentralized escrow commerce platform. It leverages **BOT Chain** smart contracts for zero-trust financial locking, a dynamic **Fiat-to-Crypto Gateway**, and a decentralized **AI Scam Verification Agent** to completely eliminate the need for human dispute resolution in digital transactions.

Built for the Botchain Hackathon.

## 🌟 Key Features

### 1. Zero-Trust Smart Contract Escrow
- **Trustless Transactions**: Buyers lock BOT tokens into a smart contract instead of sending them directly to a seller.
- **Automated Settlement**: Funds are only released when the buyer cryptographically confirms delivery.
- **Secure Treasury**: Native marketplace liquidity is managed through a decentralized Treasury.

### 2. Live Fiat-to-Crypto On-Ramp & Off-Ramp
- **Paystack Integration**: Built-in African fiat gateway allows users to buy BOT directly with NGN/USD via bank transfer or card.
- **Server-Side Security**: Token disbursements are calculated securely on a Next.js backend using live API exchange rates (Coinstore & ExchangeRate-API), preventing frontend manipulation.
- **Idempotent Webhooks**: Double-spend and replay attacks are prevented using Firestore transaction locks.
- **Dynamic 2% Protocol Fee**: Built-in revenue model that automatically deducts and routes a 2% fee during fiat onboarding.

### 3. AI-Powered Dispute Resolution
- **Botrow AI Agent**: In the event of a dispute, an autonomous AI Agent reviews chat logs and transaction metadata.
- **Intelligent Ruling**: The AI can execute refunds or force settlements by cryptographically interacting with the protocol, eliminating the need for a human customer support team.

## 🏗️ Architecture Stack

- **Frontend**: Next.js 14 (App Router), React, TailwindCSS
- **Web3 / Blockchain**: Viem, Wagmi, Reown AppKit, BOT Chain Testnet
- **Backend & API**: Next.js Serverless Routes
- **Database / State**: Firebase Firestore
- **Fiat Gateway**: Paystack

## 🚀 How It Works

1. **Onboarding**: A user connects their wallet (Reown AppKit) and clicks the "Fiat Gateway" button. They can purchase BOT using their local fiat currency via Paystack.
2. **Verification**: The Next.js backend verifies the Paystack transaction, checks live Coinstore rates, ensures the Treasury has liquidity, and instantly signs a Web3 transaction to disburse the BOT tokens to the user.
3. **Commerce**: The user browses the marketplace and buys an item. Their BOT is sent to the `Marketplace.sol` smart contract and locked in escrow.
4. **Delivery**: The seller delivers the digital good/service.
5. **Settlement**: The buyer clicks "Confirm Delivery", which triggers the smart contract to release the funds directly to the seller's wallet, whilst firing off an automated lifecycle email.

## 🔐 Environment Variables

To run this project locally, create a `.env.local` file with the following:

```env
# Web3 Auth
NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_id
NEXT_PUBLIC_TREASURY_ADDRESS=0x...

# Paystack Gateway (Testnet or Live)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_SECRET_KEY=sk_test_...

# Faucet / Smart Contract Admin
FAUCET_PRIVATE_KEY=0x...

# Botrow AI Agent
GEMINI_API_KEY=AIzaSy...

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

*Note: Never commit your `.env.local` file to GitHub, especially if using live Paystack keys.*

## 💻 Running Locally

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Navigate to `http://localhost:3000` to interact with the dApp.

---
*Built with ❤️ for the Botchain Ecosystem.*
