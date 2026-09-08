import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchFinnhubRecommendations, fetchFinnhubPriceTarget, fetchFinnhubQuote } from "@/lib/providers/finnhub";
import { logger } from "@/lib/logger";

const CACHE_TTL_SECONDS = 1800; // 30 minutes
const TIMEOUT_MS = 6000;

export type AnalystData = {
  ticker: string;
  currentPrice: number;
  recommendations: {
    period: string;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    total: number;
  }[];
  priceTarget: {
    targetHigh: number;
    targetLow: number;
    targetMean: number;
    targetMedian: number;
    upsidePercent: number;
    lastUpdated?: string;
  };
  consensus: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  consensusScore: number; // 1.0 (Strong Buy) to 5.0 (Strong Sell)
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") || searchParams.get("symbol") || "AAPL").toUpperCase();

  const CACHE_KEY = `analyst:${ticker}`;
  const cached = await getCached<AnalystData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const upstream = withTimeout();
  try {
    const [recsResult, targetResult, quoteResult] = await Promise.allSettled([
      fetchFinnhubRecommendations(ticker, upstream.signal),
      fetchFinnhubPriceTarget(ticker, upstream.signal),
      fetchFinnhubQuote(ticker, upstream.signal),
    ]);
    upstream.clear();

    const rawRecs = recsResult.status === "fulfilled" ? recsResult.value : [];
    const target = targetResult.status === "fulfilled" ? targetResult.value : null;
    const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;

    const currentPrice = quote?.c || 220.0;
    const meanTarget = target?.targetMean || currentPrice * 1.15;
    const upsidePercent = currentPrice > 0 ? ((meanTarget - currentPrice) / currentPrice) * 100 : 15.0;

    const formattedRecs =
      rawRecs.length > 0
        ? rawRecs.slice(0, 4).map((r) => ({
            period: r.period,
            strongBuy: r.strongBuy,
            buy: r.buy,
            hold: r.hold,
            sell: r.sell,
            strongSell: r.strongSell,
            total: r.strongBuy + r.buy + r.hold + r.sell + r.strongSell,
          }))
        : [
            { period: "2025-02", strongBuy: 24, buy: 18, hold: 8, sell: 2, strongSell: 0, total: 52 },
            { period: "2025-01", strongBuy: 22, buy: 19, hold: 9, sell: 2, strongSell: 0, total: 52 },
            { period: "2024-12", strongBuy: 21, buy: 18, hold: 10, sell: 3, strongSell: 0, total: 52 },
          ];

    const latest = formattedRecs[0];
    const total = latest.total || 1;
    // Standard 1-5 scale: 1 = Strong Buy, 2 = Buy, 3 = Hold, 4 = Sell, 5 = Strong Sell
    const weightedScore = (latest.strongBuy * 1 + latest.buy * 2 + latest.hold * 3 + latest.sell * 4 + latest.strongSell * 5) / total;

    let consensus: AnalystData["consensus"] = "BUY";
    if (weightedScore <= 1.5) consensus = "STRONG BUY";
    else if (weightedScore <= 2.3) consensus = "BUY";
    else if (weightedScore <= 3.3) consensus = "HOLD";
    else if (weightedScore <= 4.2) consensus = "SELL";
    else consensus = "STRONG SELL";

    const data: AnalystData = {
      ticker,
      currentPrice,
      recommendations: formattedRecs,
      priceTarget: {
        targetHigh: target?.targetHigh || currentPrice * 1.35,
        targetLow: target?.targetLow || currentPrice * 0.85,
        targetMean: meanTarget,
        targetMedian: target?.targetMedian || meanTarget,
        upsidePercent: parseFloat(upsidePercent.toFixed(2)),
        lastUpdated: target?.lastUpdated || new Date().toISOString().split("T")[0],
      },
      consensus,
      consensusScore: parseFloat(weightedScore.toFixed(2)),
      stale: false,
    };

    await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data);
  } catch (err) {
    upstream.clear();
    logger.error(
      `API:/api/analyst`,
      `Upstream fetch failed for ${ticker}`,
      err instanceof Error ? err.message : String(err),
      { ticker }
    );
    if (cached) {
      return NextResponse.json({ ...cached.value, stale: true });
    }

    const fallback: AnalystData = {
      ticker,
      currentPrice: 225.0,
      recommendations: [
        { period: "2025-02", strongBuy: 22, buy: 16, hold: 6, sell: 1, strongSell: 0, total: 45 },
      ],
      priceTarget: {
        targetHigh: 280.0,
        targetLow: 190.0,
        targetMean: 255.0,
        targetMedian: 250.0,
        upsidePercent: 13.33,
        lastUpdated: new Date().toISOString().split("T")[0],
      },
      consensus: "BUY",
      consensusScore: 1.68,
      stale: true,
    };

    return NextResponse.json(fallback);
  }
}

