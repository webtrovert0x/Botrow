import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import ContextProvider from "@/context";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Botrow | Autonomous DePIN & AI Escrow Protocol on BOT Chain",
  description: "Next-generation peer-to-peer decentralized escrow commerce powered by BOT Chain smart contracts and Botrow AI scam verification.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="en" data-theme="dark">
      <body className="cyber-bg min-h-screen flex flex-col antialiased selection:bg-cyan-500/30 selection:text-white">
        <ContextProvider cookies={cookies}>
          <ThemeProvider>
            <Navbar />
            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-16">
              {children}
            </main>
            <Footer />
            <Toaster position="top-right" toastOptions={{
              style: {
                background: '#0B0D13',
                color: '#fff',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontFamily: 'monospace',
                fontSize: '14px',
              },
            }} />
          </ThemeProvider>
        </ContextProvider>
      </body>
    </html>
  );
}