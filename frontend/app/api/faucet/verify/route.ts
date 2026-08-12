import { NextResponse } from 'next/server';
import { createWalletClient, http, parseEther, createPublicClient, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const botchain = {
  id: 677,
  name: 'BOT Chain Mainnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.ai'] },
  },
};

// Per-transaction limit to protect mainnet treasury pool
// Testnet: 100 BOT max | Mainnet: lower this significantly
const MAX_BOT_PER_TRANSACTION = parseFloat(process.env.MAX_BOT_PER_TX || "100");

// Set ALLOW_RATE_FALLBACK=false in production to hard-reject when live rates fail
const ALLOW_RATE_FALLBACK = process.env.ALLOW_RATE_FALLBACK !== "false";

export async function POST(req: Request) {
  const claimRef_temp = { path: '' }; // Placeholder for claimRef before we can set it
  let claimRef: ReturnType<typeof doc> | null = null;

  try {
    // ─────────────────────────────────────────────
    // STEP 1: Validate Request Body
    // ─────────────────────────────────────────────
    const { reference, walletAddress } = await req.json();

    if (!reference || !walletAddress) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // Validate wallet address at the runtime level (not just TypeScript assertion)
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 });
    }

    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;

    if (!paystackSecret || !faucetPrivateKey) {
      console.error("Missing Paystack or Faucet env variables");
      return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    // ─────────────────────────────────────────────
    // STEP 2: Verify Paystack Reference
    // ─────────────────────────────────────────────
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const verifyData = await verifyRes.json();

    // ─────────────────────────────────────────────
    // STEP 3: Confirm status = success AND currency = NGN
    // ─────────────────────────────────────────────
    if (
      !verifyData.status ||
      verifyData.data.status !== "success" ||
      verifyData.data.currency !== "NGN"
    ) {
      console.error("Paystack verification failed or wrong currency:", verifyData?.data?.status, verifyData?.data?.currency);
      return NextResponse.json({ success: false, error: 'Invalid payment' }, { status: 400 });
    }

    // Extract the ACTUAL amount paid in Kobo, convert to NGN
    const amountInKobo = verifyData.data.amount;
    const amountInNgn = amountInKobo / 100;

    // ─────────────────────────────────────────────
    // STEP 4: Idempotency Check — ensure this reference hasn't been processed or is currently processing
    // ─────────────────────────────────────────────
    claimRef = doc(db, "faucet_claims", reference);
    const claimSnap = await getDoc(claimRef);
    if (claimSnap.exists()) {
      const claimData = claimSnap.data();
      if (claimData.status === "completed" || claimData.status === "processing") {
        console.error("Duplicate or in-progress claim for reference:", reference);
        return NextResponse.json({ success: false, error: 'Payment already processed' }, { status: 400 });
      }
      // If status is "failed", we allow a retry (the user paid but BOT wasn't sent)
    }

    // ─────────────────────────────────────────────
    // STEP 5: Fetch Authoritative Live Exchange Rates
    // ─────────────────────────────────────────────
    let usdToNgnRate: number | null = null;
    let botToUsdRate: number | null = null;

    try {
      const [ngnRes, botRes] = await Promise.all([
        fetch("https://api.exchangerate-api.com/v4/latest/USD"),
        fetch("https://api.coinstore.com/api/v1/ticker/price")
      ]);
      const ngnData = await ngnRes.json();
      if (ngnData?.rates?.NGN) usdToNgnRate = ngnData.rates.NGN;

      const botData = await botRes.json();
      if (botData?.data && Array.isArray(botData.data)) {
        const botTicker = botData.data.find((t: any) => t.symbol === "BOTUSDT");
        if (botTicker && botTicker.price) botToUsdRate = parseFloat(botTicker.price);
      }
    } catch (err) {
      console.error("[Faucet] Rate fetch failed:", err);
    }

    if (!usdToNgnRate || !botToUsdRate) {
      if (!ALLOW_RATE_FALLBACK) {
        // Mainnet: hard-reject if we can't get live rates
        console.error("[Faucet] Rejecting — live rates unavailable and fallbacks are disabled.");
        return NextResponse.json(
          { success: false, error: 'Unable to obtain current exchange rate. Please try again.' },
          { status: 503 }
        );
      }
      // Mainnet: use fallback rates so the demo is not blocked by API flakiness
      usdToNgnRate = usdToNgnRate ?? 1580;
      botToUsdRate = botToUsdRate ?? 0.50;
      console.warn(`[Faucet] Using fallback rates: 1 USD = ${usdToNgnRate} NGN, 1 BOT = ${botToUsdRate} USD`);
    }
    console.log(`[Faucet] Live rates: 1 USD = ${usdToNgnRate} NGN, 1 BOT = ${botToUsdRate} USD`);

    // ─────────────────────────────────────────────
    // STEP 6: Calculate BOT Amount Server-Side (Apply 2% Fee)
    // ─────────────────────────────────────────────
    const usdAmount = amountInNgn / usdToNgnRate;
    const grossBotAmount = usdAmount / botToUsdRate;
    const botAmount = grossBotAmount * 0.98; // Deduct 2% platform fee
    
    console.log(`[Faucet] NGN paid: ${amountInNgn}, Gross BOT: ${grossBotAmount}, Net BOT: ${botAmount}, Max allowed: ${MAX_BOT_PER_TRANSACTION}`);

    // ─────────────────────────────────────────────
    // STEP 7: Check max per-transaction limit
    // ─────────────────────────────────────────────
    if (botAmount > MAX_BOT_PER_TRANSACTION) {
      console.error(`[Faucet] BOT amount ${botAmount} exceeds MAX_BOT_PER_TX ${MAX_BOT_PER_TRANSACTION}`);
      return NextResponse.json(
        { success: false, error: `Amount exceeds transaction limit of ${MAX_BOT_PER_TRANSACTION} BOT` },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // STEP 8: Setup Viem Clients & Check Treasury Balance
    // ─────────────────────────────────────────────
    const formattedKey = faucetPrivateKey.startsWith('0x') ? faucetPrivateKey : `0x${faucetPrivateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const publicClient = createPublicClient({ chain: botchain, transport: http() });
    const walletClient = createWalletClient({ account, chain: botchain, transport: http() });

    const balance = await publicClient.getBalance({ address: account.address });
    const amountInWei = parseEther(botAmount.toString());

    if (balance < amountInWei) {
      console.error("Insufficient Treasury Balance");
      return NextResponse.json({ success: false, error: 'Treasury pool insufficient' }, { status: 500 });
    }

    // ─────────────────────────────────────────────
    // STEP 9: Mark Claim as PROCESSING (before sending BOT)
    // ─────────────────────────────────────────────
    await setDoc(claimRef, {
      status: "processing",
      walletAddress,
      amountInNgn,
      botAmount,
      usdToNgnRate,
      botToUsdRate,
      createdAt: serverTimestamp(),
    }, { merge: true });

    // ─────────────────────────────────────────────
    // STEP 10 & 11: Send BOT and Wait for Receipt
    // ─────────────────────────────────────────────
    let hash: `0x${string}`;
    try {
      hash = await walletClient.sendTransaction({
        to: walletAddress as `0x${string}`,
        value: amountInWei
      });

      await publicClient.waitForTransactionReceipt({ hash });
    } catch (txError) {
      console.error("BOT transaction failed:", txError);
      // Mark claim as failed so it can be retried
      await setDoc(claimRef, {
        status: "failed",
        error: "BOT transfer failed on-chain",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return NextResponse.json({ success: false, error: 'BOT transfer failed. Contact support with your Paystack reference.' }, { status: 500 });
    }

    // ─────────────────────────────────────────────
    // STEP 12: Mark Claim as COMPLETED with txHash
    // ─────────────────────────────────────────────
    await setDoc(claimRef, {
      status: "completed",
      txHash: hash,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // ─────────────────────────────────────────────
    // STEP 13: Return Success
    // ─────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      txHash: hash,
      botAmount
    }, { status: 200 });

  } catch (error) {
    console.error("Faucet Error:", error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
