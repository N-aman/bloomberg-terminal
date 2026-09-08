import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchFxRates } from "@/lib/providers/frankfurter";

const CACHE_TTL_SECONDS = 300; // 5 minutes
const TIMEOUT_MS = 6000;

const FX_BASKETS: Record<string, string[]> = {
  G8: ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "INR"],
  EM: ["USD", "CNY", "INR", "BRL", "MXN", "ZAR", "TRY", "KRW"],
  APAC: ["USD", "JPY", "CNY", "HKD", "SGD", "KRW", "INR", "AUD"],
  EUROPE: ["EUR", "GBP", "CHF", "SEK", "NOK", "PLN", "CZK", "USD"],
};

export type FxCrossRateCell = {
  base: string;
  quote: string;
  rate: number;
  inverseRate: number;
};

export type FxMatrixData = {
  basket?: string;
  currencies: string[];
  matrix: Record<string, Record<string, number>>; // matrix[base][quote] = rate
  date: string;
  stale: boolean;
  simulated?: boolean;
  source?: string;
};

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

// Fallback rates relative to USD
const FALLBACK_USD_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.958,
  GBP: 0.795,
  JPY: 154.25,
  CHF: 0.898,
  CAD: 1.425,
  AUD: 1.585,
  NZD: 1.725,
  INR: 87.25,
  CNY: 7.245,
  HKD: 7.785,
  SGD: 1.345,
  KRW: 1415.0,
  BRL: 5.75,
  MXN: 20.35,
  ZAR: 18.25,
  TRY: 36.20,
  SEK: 10.75,
  NOK: 11.10,
  PLN: 4.10,
  CZK: 24.20,
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const basketParam = (searchParams.get("basket") || "").toUpperCase();
  const currenciesParam = searchParams.get("currencies");

  let requestedCurrencies: string[];

  if (currenciesParam) {
    const raw = currenciesParam
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 3);
    const unique = Array.from(new Set(raw));
    requestedCurrencies = unique.length >= 2 ? unique.slice(0, 10) : FX_BASKETS.G8;
  } else if (basketParam && FX_BASKETS[basketParam]) {
    requestedCurrencies = FX_BASKETS[basketParam];
  } else {
    requestedCurrencies = FX_BASKETS.G8;
  }

  const CACHE_KEY = `fx:cross_matrix:${[...requestedCurrencies].sort().join("_")}`;
  const cached = await getCached<FxMatrixData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const upstream = withTimeout();
  try {
    const fx = await fetchFxRates(upstream.signal, "USD", requestedCurrencies);
    upstream.clear();

    const usdRates: Record<string, number> = { USD: 1.0 };
    if (fx && fx.rates) {
      for (const cur of requestedCurrencies) {
        if (cur === "USD") continue;
        usdRates[cur] = fx.rates[cur] || FALLBACK_USD_RATES[cur] || 1.0;
      }
    } else {
      for (const cur of requestedCurrencies) {
        usdRates[cur] = FALLBACK_USD_RATES[cur] || 1.0;
      }
    }

    // Build reciprocal cross-rate matrix:
    // Rate for Base / Quote = (USD -> Quote) / (USD -> Base)
    const matrix: Record<string, Record<string, number>> = {};
    for (const base of requestedCurrencies) {
      matrix[base] = {};
      for (const quote of requestedCurrencies) {
        if (base === quote) {
          matrix[base][quote] = 1.0;
        } else {
          const cross = usdRates[quote] / usdRates[base];
          matrix[base][quote] = parseFloat(cross.toFixed(cross >= 100 ? 2 : cross >= 1 ? 4 : 4));
        }
      }
    }

    const data: FxMatrixData = {
      basket: basketParam || (currenciesParam ? "CUSTOM" : "G8"),
      currencies: requestedCurrencies,
      matrix,
      date: fx?.date || new Date().toISOString().split("T")[0],
      stale: false,
    };

    await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data);
  } catch {
    upstream.clear();
    if (cached) {
      return NextResponse.json({ ...cached.value, stale: true });
    }

    const matrix: Record<string, Record<string, number>> = {};
    for (const base of requestedCurrencies) {
      matrix[base] = {};
      for (const quote of requestedCurrencies) {
        if (base === quote) {
          matrix[base][quote] = 1.0;
        } else {
          const baseRate = FALLBACK_USD_RATES[base] || 1.0;
          const quoteRate = FALLBACK_USD_RATES[quote] || 1.0;
          const cross = quoteRate / baseRate;
          matrix[base][quote] = parseFloat(cross.toFixed(cross >= 100 ? 2 : cross >= 1 ? 4 : 4));
        }
      }
    }

    return NextResponse.json({
      basket: basketParam || "G8",
      currencies: requestedCurrencies,
      matrix,
      date: new Date().toISOString().split("T")[0],
      stale: true,
    });
  }
}
