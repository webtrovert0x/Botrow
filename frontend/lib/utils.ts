import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBOT(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num) + " BOT";
}

export function truncateAddress(address?: string): string {
  if (!address) return "0x000...0000";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
