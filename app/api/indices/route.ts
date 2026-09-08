import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchFxRates, type FxRate } from "@/lib/providers/frankfurter";
import { fetchCryptoGlobal, type CryptoGlobal } from "@/lib/providers/coingecko";
import { fetchFredSeries } from "@/lib/providers/fred";

const CACHE_TTL_SECONDS = 300;
const TIMEOUT_MS = 6000;

export type IndicesData = {
  fx: FxRate | null;
  crypto: CryptoGlobal | null;
  sp500: { value: number; date: string } | null;
  stale: boolean;
};

type CachedIndices = Omit<IndicesData, "stale">;

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") || searchParams.get("base") || "USD").toUpperCase();
  const toParam = searchParams.get("to") || searchParams.get("quote") || "";
  const toList = toParam ? toParam.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined;

  const CACHE_KEY = `indices:wei:${from}:${toList?.join(",") || "default"}`;
  const cached = await getCached<CachedIndices>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const upstream = withTimeout();
  try {
    const [fxResult, cryptoResult, sp500Result] = await Promise.allSettled([
      fetchFxRates(upstream.signal, from, toList),
      fetchCryptoGlobal(upstream.signal),
      fetchFredSeries("SP500", upstream.signal).then((s) => {
        const last = s.observations[s.observations.length - 1];
        return last ? { value: last.value as number, date: last.date } : null;
      }),
    ]);

    const data: CachedIndices = {
      fx: fxResult.status === "fulfilled" ? fxResult.value : null,
      crypto: cryptoResult.status === "fulfilled" ? cryptoResult.value : null,
      sp500: sp500Result.status === "fulfilled" ? sp500Result.value : null,
    };

    if (data.fx || data.crypto || data.sp500) {
      await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    }

    return NextResponse.json({ ...data, stale: false });
  } catch {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(
      { fx: null, crypto: null, sp500: null, stale: false },
      { status: 503 }
    );
  } finally {
    upstream.clear();
  }
}
