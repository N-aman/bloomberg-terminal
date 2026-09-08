import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { generateOptionChain, type OptionChain } from "@/lib/providers/options";

const CACHE_TTL_SECONDS = 60; // 1 min TTL for options chain

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") || searchParams.get("ticker") || "AAPL").trim().toUpperCase();
  const dte = Math.min(180, Math.max(7, Number(searchParams.get("dte")) || 30));

  const CACHE_KEY = `options:chain:v1:${symbol}:${dte}`;
  const cached = await getCached<OptionChain>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  try {
    const data = generateOptionChain(symbol, dte);
    await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data);
  } catch {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(
      { error: `Options chain unavailable for ${symbol}.` },
      { status: 503 }
    );
  }
}

