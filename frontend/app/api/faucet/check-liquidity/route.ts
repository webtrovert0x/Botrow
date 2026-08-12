import { NextResponse } from 'next/server';
import { http, parseEther, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const botchain = {
  id: 677,
  name: 'BOT Chain Mainnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.ai'] },
  },
};

const MAX_BOT_PER_TRANSACTION = parseFloat(process.env.MAX_BOT_PER_TX || "100");

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const botAmountParam = searchParams.get("botAmount");
    
    if (!botAmountParam) {
      return NextResponse.json({ success: false, error: "Missing botAmount" }, { status: 400 });
    }

    const requestedBotAmount = parseFloat(botAmountParam);
    if (isNaN(requestedBotAmount) || requestedBotAmount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid botAmount" }, { status: 400 });
    }

    if (requestedBotAmount > MAX_BOT_PER_TRANSACTION) {
      return NextResponse.json({ 
        success: true, 
        available: false, 
        reason: `Amount exceeds maximum per-transaction limit of ${MAX_BOT_PER_TRANSACTION} BOT.` 
      });
    }

    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!faucetPrivateKey) {
      return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    const formattedKey = faucetPrivateKey.startsWith('0x') ? faucetPrivateKey : `0x${faucetPrivateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const publicClient = createPublicClient({ chain: botchain, transport: http() });
    
    const balance = await Promise.race([
      publicClient.getBalance({ address: account.address }),
      new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error("RPC Timeout")), 8000))
    ]);
    const requestedAmountInWei = parseEther(requestedBotAmount.toString());

    if (balance < requestedAmountInWei) {
      return NextResponse.json({ 
        success: true, 
        available: false, 
        reason: "The Treasury pool is currently empty or does not have enough liquidity for this transaction." 
      });
    }

    return NextResponse.json({ success: true, available: true });
  } catch (error) {
    console.error("Check Liquidity Error:", error);
    return NextResponse.json({ success: false, error: 'Failed to check liquidity' }, { status: 500 });
  }
}
