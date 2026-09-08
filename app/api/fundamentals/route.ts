import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCached, setCached } from "@/lib/cache";
import { fetchCompanyFundamentals, type CompanyFundamentals } from "@/lib/providers/fundamentals";

const CACHE_TTL_SECONDS = 86400; // 24h for known tickers
const UNAVAILABLE_TTL_SECONDS = 3600; // 1h for unavailable tickers

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") || searchParams.get("symbol") || "AAPL").trim().toUpperCase();

  const CACHE_KEY = `fundamentals:v2:${ticker}`;
  const cached = await getCached<CompanyFundamentals>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  try {
    const data = await fetchCompanyFundamentals(ticker);
    const ttl = data.unavailable ? UNAVAILABLE_TTL_SECONDS : CACHE_TTL_SECONDS;
    await setCached(CACHE_KEY, data, ttl);
    return NextResponse.json(data);
  } catch (err) {
    logger.error(`API:/api/fundamentals`, `Request failed for ${ticker}`, err instanceof Error ? err.message : String(err));
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(
      { error: `Financial fundamentals unavailable for ${ticker}.` },
      { status: 503 }
    );
  }
}
