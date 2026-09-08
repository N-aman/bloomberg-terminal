import type { OhlcvBar } from "./chart";

/**
 * Fetches authentic multi-decade historical OHLCV bars from Yahoo Finance
 * Supported intervals: '1d', '1wk', '1mo'
 * Supported ranges: '1y', '5y', '10y', 'max'
 */
export async function fetchYahooHistoricalBars(
  symbol: string,
  interval: "1d" | "1wk" | "1mo" | "1h" = "1mo",
  range: "1y" | "2y" | "5y" | "10y" | "max" = "max"
): Promise<OhlcvBar[]> {
  const sym = symbol.trim().toUpperCase();
  const now = Math.floor(Date.now() / 1000);
  const rangeParam = range === "max" ? `period1=0&period2=${now}` : `range=${range}`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    sym
  )}?interval=${interval}&${rangeParam}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    // Cache for 10 minutes
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance chart query failed for ${sym} with status ${response.status}`);
  }

  const data = await response.json();
  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    return [];
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  const { open, high, low, close, volume } = quote;

  const isHourly = interval === "1h";
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = open?.[i];
    const h = high?.[i];
    const l = low?.[i];
    const c = close?.[i];
    const v = volume?.[i];

    if (
      typeof o === "number" &&
      typeof h === "number" &&
      typeof l === "number" &&
      typeof c === "number" &&
      !Number.isNaN(o) &&
      !Number.isNaN(h) &&
      !Number.isNaN(l) &&
      !Number.isNaN(c)
    ) {
      const d = new Date(timestamps[i] * 1000);
      const timeStr = isHourly
        ? d.toISOString().replace("T", " ").slice(0, 16)
        : d.toISOString().slice(0, 10);
      bars.push({
        time: timeStr,
        open: Math.round(o * 100) / 100,
        high: Math.round(h * 100) / 100,
        low: Math.round(l * 100) / 100,
        close: Math.round(c * 100) / 100,
        volume: typeof v === "number" && !Number.isNaN(v) ? v : 0,
      });
    }
  }

  return bars;
}
