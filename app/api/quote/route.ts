import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchStockQuote, getAlpacaCredentials, isEquitySymbol } from "@/lib/providers/alpaca";

const CACHE_TTL_SECONDS = 5; // 5s for top-of-book quotes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || searchParams.get("ticker") || "AAPL").trim().toUpperCase();

  const CACHE_KEY = `quote:stock:v1:${symbol}`;
  const cached = await getCached<any>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const { isConfigured } = getAlpacaCredentials();
  if (!isConfigured) {
    return NextResponse.json(
      { error: "Alpaca API credentials not configured in environment." },
      { status: 503 }
    );
  }

  try {
    const quote = await fetchStockQuote(symbol);
    await setCached(CACHE_KEY, quote, CACHE_TTL_SECONDS);
    return NextResponse.json(quote);
  } catch (err) {
    return NextResponse.json(
      { error: `Quote unavailable for ${symbol}: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}

