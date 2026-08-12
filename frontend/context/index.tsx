"use client";

import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import { wagmiAdapter, projectId } from "@/config";
import { botChainMainnet } from "@/config/chains";

// Set up queryClient
const queryClient = new QueryClient();

// Set up metadata
const metadata = {
  name: "Botrow",
  description: "Autonomous Zero-Trust Escrow & Clearinghouse on BOT Chain",
  url: "https://botrow.xyz", // origin must match your domain & subdomain
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [botChainMainnet],
  defaultNetwork: botChainMainnet,
  metadata: metadata,
  features: {
    analytics: false, // Set to false by default for clean hackathon testing
  },
});

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;