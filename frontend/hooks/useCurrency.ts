import { useState, useEffect } from "react";

export function useCurrency() {
  const [usdToNgnRate, setUsdToNgnRate] = useState<number>(1500); // Fallback rate
  const [botToUsdRate, setBotToUsdRate] = useState<number>(0.50); // Fallback rate
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const [ngnRes, botRes] = await Promise.all([
          fetch("https://api.exchangerate-api.com/v4/latest/USD"),
          fetch("https://api.coinstore.com/api/v1/ticker/price")
        ]);

        const ngnData = await ngnRes.json();
        if (ngnData?.rates?.NGN) {
          setUsdToNgnRate(ngnData.rates.NGN);
        }

        const botData = await botRes.json();
        if (botData?.data && Array.isArray(botData.data)) {
          const botTicker = botData.data.find((t: any) => t.symbol === "BOTUSDT");
          if (botTicker && botTicker.price) {
            setBotToUsdRate(parseFloat(botTicker.price));
          }
        }
      } catch (err) {
        console.error("Failed to fetch live rates, using fallbacks.", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRates();
  }, []);

  const convertBotToUsd = (botAmount: number) => {
    return botAmount * botToUsdRate;
  };

  const convertBotToNgn = (botAmount: number) => {
    return convertBotToUsd(botAmount) * usdToNgnRate;
  };

  const convertUsdToBot = (usdAmount: number) => {
    return botToUsdRate > 0 ? usdAmount / botToUsdRate : 0;
  };

  const convertNgnToBot = (ngnAmount: number) => {
    const usdAmount = usdToNgnRate > 0 ? ngnAmount / usdToNgnRate : 0;
    return convertUsdToBot(usdAmount);
  };

  const formatUsd = (usdAmount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(usdAmount);
  };

  const formatNgn = (ngnAmount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0, // Naira usually doesn't show kobo
    }).format(ngnAmount);
  };

  return {
    convertBotToUsd,
    convertBotToNgn,
    convertUsdToBot,
    convertNgnToBot,
    formatUsd,
    formatNgn,
    usdToNgnRate,
    botToUsdRate,
    isLoading,
  };
}
