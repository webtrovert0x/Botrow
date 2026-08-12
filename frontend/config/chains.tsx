import { defineChain } from "viem";

export const botChainMainnet = defineChain({
  id: 677,
  name: "BOT Chain",
  network: "bot-chain-mainnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.botchain.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "BOT Explorer",
      url: "https://scan.botchain.ai/",
    },
  },
});