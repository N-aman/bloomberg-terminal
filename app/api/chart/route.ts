import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchChartBars, type ChartData } from "@/lib/providers/chart";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || searchParams.get("ticker") || "AAPL").trim().toUpperCase();
  const interval = (searchParams.get("interval") || "1d").trim();
  const range = (searchParams.get("range") || "").trim().toUpperCase();
  const limit = Math.min(10000, Math.max(10, Number(searchParams.get("limit")) || (range === "ALL" ? 10000 : 90)));

  const isIntraday = ["1m", "5m", "15m", "30m", "1h", "4h"].includes(interval.toLowerCase()) && interval !== "1M";
  const cacheTtlSeconds = isIntraday ? 15 : range === "ALL" ? 600 : 180;

  const CACHE_KEY = `chart:ohlcv:v7:${symbol}:${interval}:${range}:${limit}`;
  const cached = await getCached<ChartData>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  try {
    const data = await fetchChartBars(symbol, interval, limit, range);
    await setCached(CACHE_KEY, data, cacheTtlSeconds);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Chart data unavailable for ${symbol}.` },
      { status: 503 }
    );
  }
}
