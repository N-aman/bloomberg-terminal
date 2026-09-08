import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchStockSnapshots, getAlpacaCredentials } from "@/lib/providers/alpaca";
import { logger } from "@/lib/logger";

const CACHE_TTL_SECONDS = 60; // 1 minute
const TIMEOUT_MS = 8000;

export type MarketMoverItem = {
  symbol: string;
  name: string;
  category: "EQUITY" | "CRYPTO";
  price: number;
  change: number;
  changePercent: number;
  volume: number;
};

export type MarketMoversData = {
  gainers: MarketMoverItem[];
  losers: MarketMoverItem[];
  mostActive: MarketMoverItem[];
  timestamp: string;
  stale: boolean;
};

const WATCH_EQUITIES = [
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "PLTR",
  "AMD", "INTC", "COIN", "SOFI", "SMCI", "SPY", "QQQ", "CRM", "NFLX"
];

const WATCH_CRYPTOS = new Set([
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "DOGEUSDT", "XRPUSDT", "SUIUSDT", "PEPEUSDT", "ADAUSDT", "AVAXUSDT"
]);

const EQUITY_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  NVDA: "NVIDIA Corp.",
  TSLA: "Tesla Inc.",
  MSFT: "Microsoft Corp.",
  AMZN: "Amazon.com Inc.",
  GOOGL: "Alphabet Inc.",
  META: "Meta Platforms",
  PLTR: "Palantir Tech",
  AMD: "Advanced Micro",
  INTC: "Intel Corp.",
  COIN: "Coinbase Global",
  SOFI: "SoFi Tech",
  SMCI: "Super Micro",
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
  CRM: "Salesforce Inc.",
  NFLX: "Netflix Inc.",
};

export async function GET(request: NextRequest) {
  const CACHE_KEY = "market:movers:v2";
  const cached = await getCached<MarketMoversData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const allItems: MarketMoverItem[] = [];

  // 1. Fetch Real Equities Snapshots from Alpaca
  const { isConfigured } = getAlpacaCredentials();
  if (isConfigured) {
    try {
      const snapshots = await fetchStockSnapshots(WATCH_EQUITIES);
      for (const [sym, snap] of Object.entries(snapshots)) {
        const price = snap.latestTrade?.price || (snap.latestQuote ? (snap.latestQuote.bidPrice + snap.latestQuote.askPrice) / 2 : snap.dailyBar?.close || 0);
        if (price > 0) {
          allItems.push({
            symbol: sym,
            name: EQUITY_NAMES[sym] || `${sym} Corp.`,
            category: "EQUITY",
            price,
            change: snap.change,
            changePercent: snap.changePercent,
            volume: snap.dailyBar?.volume || 0,
          });
        }
      }
    } catch (err) {
      logger.error("API:/api/movers", "Alpaca snapshots fetch failed", err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Fetch Real Crypto 24hr Tickers from Binance
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const binanceRes = await fetch("https://api.binance.com/api/v3/ticker/24hr", { signal: controller.signal });
    clearTimeout(timer);

    if (binanceRes.ok) {
      const cryptoTickers = (await binanceRes.json()) as {
        symbol: string;
        lastPrice: string;
        priceChange: string;
        priceChangePercent: string;
        quoteVolume: string;
      }[];

      for (const ct of cryptoTickers) {
        if (WATCH_CRYPTOS.has(ct.symbol)) {
          allItems.push({
            symbol: ct.symbol,
            name: ct.symbol.replace("USDT", " / USDT"),
            category: "CRYPTO",
            price: parseFloat(ct.lastPrice),
            change: parseFloat(ct.priceChange),
            changePercent: parseFloat(ct.priceChangePercent),
            volume: parseFloat(ct.quoteVolume),
          });
        }
      }
    }
  } catch (err) {
    logger.error("API:/api/movers", "Binance tickers fetch failed", err instanceof Error ? err.message : String(err));
  }

  if (allItems.length === 0) {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json({ error: "Market movers data unavailable." }, { status: 503 });
  }

  const gainers = [...allItems].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
  const losers = [...allItems].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
  const mostActive = [...allItems].sort((a, b) => b.volume - a.volume).slice(0, 10);

  const data: MarketMoversData = {
    gainers,
    losers,
    mostActive,
    timestamp: new Date().toISOString(),
    stale: false,
  };

  await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
  return NextResponse.json(data);
}
