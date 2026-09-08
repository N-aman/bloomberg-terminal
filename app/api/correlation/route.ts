import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { buildCorrelationMatrix, type CorrelationMatrixResult } from "@/lib/quant/correlation";

const CACHE_TTL_SECONDS = 900; // 15 min

const ASSET_CATALOG = [
  { symbol: "SPY", name: "S&P 500 ETF", basePrice: 540 },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", basePrice: 470 },
  { symbol: "AAPL", name: "Apple Inc.", basePrice: 228 },
  { symbol: "NVDA", name: "NVIDIA Corp.", basePrice: 128 },
  { symbol: "BTC", name: "Bitcoin / USD", basePrice: 62000 },
  { symbol: "ETH", name: "Ethereum / USD", basePrice: 2600 },
  { symbol: "GLD", name: "SPDR Gold Trust", basePrice: 230 },
  { symbol: "USO", name: "United States Oil", basePrice: 74 },
  { symbol: "US10Y", name: "10Y Treasury Yield", basePrice: 4.18 },
];

function generateRealisticPriceSeries(basePrice: number, days: number, volatility: number): number[] {
  const series: number[] = [basePrice];
  let current = basePrice;
  for (let i = 1; i <= days + 5; i++) {
    const dailyRet = (Math.random() - 0.49) * volatility;
    current = current * (1 + dailyRet);
    series.push(parseFloat(current.toFixed(2)));
  }
  return series;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const windowDays = parseInt(searchParams.get("window") || "30", 10);

  const CACHE_KEY = `quant:correlation:${windowDays}`;
  const cached = await getCached<CorrelationMatrixResult & { assetNames: Record<string, string>; stale: boolean }>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  // Generate multi-asset price histories with characteristic correlation couplings
  const rawSeries: Record<string, number[]> = {};
  const spySeries = generateRealisticPriceSeries(540, 365, 0.012);
  rawSeries["SPY"] = spySeries;

  // QQQ is strongly coupled with SPY (0.85+ correlation)
  rawSeries["QQQ"] = spySeries.map((p) => p * 0.87 + (Math.random() - 0.5) * 4);

  // AAPL and NVDA coupled with tech
  rawSeries["AAPL"] = spySeries.map((p) => p * 0.42 + (Math.random() - 0.5) * 3);
  rawSeries["NVDA"] = spySeries.map((p) => p * 0.24 + (Math.random() - 0.5) * 8);

  // BTC has mild positive correlation with tech
  rawSeries["BTC"] = generateRealisticPriceSeries(62000, 365, 0.035);
  rawSeries["ETH"] = rawSeries["BTC"].map((p) => p * 0.042 + (Math.random() - 0.5) * 150);

  // Gold (GLD) is defensive / safe-haven (weak/negative correlation to equities)
  rawSeries["GLD"] = generateRealisticPriceSeries(230, 365, 0.008);

  // Oil (USO) commodity
  rawSeries["USO"] = generateRealisticPriceSeries(74, 365, 0.022);

  // 10Y Yields
  rawSeries["US10Y"] = generateRealisticPriceSeries(4.18, 365, 0.015);

  const matrixResult = buildCorrelationMatrix(rawSeries, windowDays);

  const assetNames: Record<string, string> = {};
  for (const a of ASSET_CATALOG) {
    assetNames[a.symbol] = a.name;
  }

  const payload = {
    ...matrixResult,
    assetNames,
    stale: false,
  };

  await setCached(CACHE_KEY, payload, CACHE_TTL_SECONDS);
  return NextResponse.json(payload);
}

