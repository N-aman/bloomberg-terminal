/**
 * OHLCV Candlestick & Technical Indicators Provider
 * Sourced from Binance (crypto) and Alpaca Market Data v2 (US Equities).
 * Supports full spectrum of Intraday Minute (1m, 5m, 15m, 30m), Hourly (1h, 4h),
 * and Multi-Day / Macro (1D, 1W, 1M, 3M, 6M, 1Y) timeframes.
 */

import { fetchHistoricalStockBars, getAlpacaCredentials } from "./alpaca";
import { fetchYahooHistoricalBars } from "./yahoo";
import { logger } from "../logger";

export type OhlcvBar = {
  time: string; // ISO date YYYY-MM-DD or YYYY-MM-DD HH:mm for intraday
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  sma20?: number | null;
  sma50?: number | null;
  rsi14?: number | null;
};

export type ChartData = {
  symbol: string;
  interval: string;
  bars: OhlcvBar[];
  currentPrice: number;
  change24hPct: number;
  stale?: boolean;
};

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSma(bars: OhlcvBar[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += bars[i - j].close;
    }
    result.push(Math.round((sum / period) * 100) / 100);
  }
  return result;
}

/**
 * Calculates Relative Strength Index (RSI 14)
 */
export function calculateRsi(bars: OhlcvBar[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (bars.length <= period) {
    return bars.map(() => null);
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result.push(...Array(period).fill(null));

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(Math.round((100 - 100 / (1 + rs)) * 10) / 10);

  for (let i = period + 1; i < bars.length; i++) {
    const diff = bars[i].close - bars[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const currentRs = avgGain / avgLoss;
      result.push(Math.round((100 - 100 / (1 + currentRs)) * 10) / 10);
    }
  }

  return result;
}

/**
 * Enriches bars with technical indicators (SMA 20, SMA 50, RSI 14)
 */
export function enrichWithIndicators(bars: OhlcvBar[]): OhlcvBar[] {
  const sma20 = calculateSma(bars, 20);
  const sma50 = calculateSma(bars, 50);
  const rsi14 = calculateRsi(bars, 14);

  return bars.map((bar, i) => ({
    ...bar,
    sma20: sma20[i],
    sma50: sma50[i],
    rsi14: rsi14[i],
  }));
}

/**
 * Aggregates finer bars (e.g. monthly or daily) into full annual (1-Year) OHLCV candles
 */
export function aggregateBarsByYear(bars: OhlcvBar[]): OhlcvBar[] {
  const groups = new Map<string, OhlcvBar[]>();
  for (const bar of bars) {
    const year = bar.time.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(bar);
  }

  const yearlyBars: OhlcvBar[] = [];
  for (const [year, yBars] of groups.entries()) {
    if (yBars.length === 0) continue;
    const open = yBars[0].open;
    const close = yBars[yBars.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of yBars) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    yearlyBars.push({
      time: `${year}-01-01`,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return yearlyBars;
}

/**
 * Aggregates 1-hour OHLCV bars into N-hour bars (e.g. 4-hour candles)
 */
export function aggregateBarsByHour(bars: OhlcvBar[], hours = 4): OhlcvBar[] {
  if (bars.length === 0) return [];
  const result: OhlcvBar[] = [];
  for (let i = 0; i < bars.length; i += hours) {
    const chunk = bars.slice(i, i + hours);
    if (chunk.length === 0) continue;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    for (const b of chunk) {
      if (b.high > high) high = b.high;
      if (b.low < low) low = b.low;
      volume += b.volume;
    }
    result.push({
      time: chunk[0].time,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return result;
}

/**
 * Computes optimal bar count to fetch based on candlestick resolution and historical lookback range
 */
export function calculateEffectiveBarLimit(
  resolutionLabel: string,
  rangeStr: string,
  fallbackLimit = 90
): number {
  const res = resolutionLabel.trim();
  const rng = rangeStr.trim().toUpperCase();

  if (rng === "ALL") {
    if (res === "1Y") return 100;
    if (res === "1M") return 600;
    if (res === "1W") return 2500;
    return 10000;
  }

  if (res === "1m") {
    if (rng === "1D") return 500;
    if (rng === "5D") return 2500;
    if (rng === "1M") return 8000;
    return 10000;
  }

  if (res === "5m") {
    if (rng === "1D") return 120;
    if (rng === "5D") return 500;
    if (rng === "1M") return 2000;
    if (rng === "3M") return 5000;
    return 10000;
  }

  if (res === "15m" || res === "30m") {
    if (rng === "1D") return 50;
    if (rng === "5D") return 200;
    if (rng === "1M") return 700;
    if (rng === "3M") return 2000;
    if (rng === "6M") return 4000;
    return 10000;
  }

  if (res === "1h" || res === "4h") {
    if (rng === "1D") return 20;
    if (rng === "5D") return 60;
    if (rng === "1M") return 200;
    if (rng === "3M") return 600;
    if (rng === "1Y") return 2000;
    return 10000;
  }

  if (res === "1D") {
    if (rng === "1D") return 5;
    if (rng === "5D") return 10;
    if (rng === "1M") return 30;
    if (rng === "3M") return 90;
    if (rng === "6M") return 180;
    if (rng === "YTD") return 220;
    if (rng === "1Y") return 365;
    if (rng === "5Y") return 1825;
    return 10000;
  }

  if (res === "1W") {
    if (rng === "1D" || rng === "5D") return 5;
    if (rng === "1M") return 5;
    if (rng === "3M") return 13;
    if (rng === "6M") return 26;
    if (rng === "YTD") return 35;
    if (rng === "1Y") return 52;
    if (rng === "5Y") return 260;
    return 2500;
  }

  if (res === "1M") {
    if (rng === "1D" || rng === "5D" || rng === "1M") return 3;
    if (rng === "3M") return 3;
    if (rng === "6M") return 6;
    if (rng === "YTD") return 9;
    if (rng === "1Y") return 12;
    if (rng === "5Y") return 60;
    return 600;
  }

  if (res === "1Y") {
    if (rng === "1Y") return 3;
    if (rng === "5Y") return 5;
    return 100;
  }

  return fallbackLimit;
}

/**
 * Fetches real historical OHLCV chart bars for any symbol (Crypto or Equities)
 * across any supported timeframe resolution (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W, 1M, 1Y)
 * and lookback range (1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, ALL).
 */
export async function fetchChartBars(
  symbol: string,
  interval = "1d",
  limit = 90,
  range?: string
): Promise<ChartData> {
  const sym = symbol.trim().toUpperCase();

  // Normalize interval token while strictly distinguishing 1m (1 minute) from 1M (1 month)
  const isMonth = interval === "1M" || interval.toLowerCase() === "1mo" || interval.toLowerCase() === "month";
  const isYear = interval.toUpperCase() === "1Y" || interval.toLowerCase() === "1y" || interval.toLowerCase() === "year";
  const isWeek = interval.toLowerCase() === "1w" || interval.toLowerCase() === "week";
  const isIntraday = ["1m", "5m", "15m", "30m", "1h", "4h"].includes(interval.toLowerCase()) && !isMonth;

  const isAll = range?.toUpperCase() === "ALL";
  const effectiveLimit = isAll ? 10000 : Math.min(10000, Math.max(10, limit));

  // 1. Crypto Pairs: Query live Binance klines
  if (sym.endsWith("USDT") || sym.endsWith("BUSD") || sym.endsWith("BTC")) {
    let binanceInterval = "1d";
    if (isMonth || isYear) {
      binanceInterval = "1M";
    } else if (isWeek) {
      binanceInterval = "1w";
    } else if (isIntraday) {
      binanceInterval = interval.toLowerCase();
    } else {
      binanceInterval = "1d";
    }

    let raw: [number, string, string, string, string, string][] = [];

    // For Monthly or Yearly crypto, query all history from Binance 2017 inception
    if (isMonth || isYear) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1M&limit=1000&startTime=1483228800000`;
      const res = await fetch(url);
      if (res.ok) {
        raw = (await res.json()) as [number, string, string, string, string, string][];
      }
    } else if (isIntraday && effectiveLimit > 1000) {
      // Multi-batch pagination for deep intraday crypto history (up to 3,000 minute bars)
      const b1Url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${binanceInterval}&limit=1000`;
      const res1 = await fetch(b1Url);
      if (res1.ok) {
        const b1 = (await res1.json()) as [number, string, string, string, string, string][];
        raw = b1;
        if (b1.length > 0 && effectiveLimit > 1000) {
          const oldestTime = b1[0][0];
          const b2Url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${binanceInterval}&limit=1000&endTime=${oldestTime - 1}`;
          const res2 = await fetch(b2Url);
          if (res2.ok) {
            const b2 = (await res2.json()) as [number, string, string, string, string, string][];
            raw = [...b2, ...raw];
            if (b2.length > 0 && effectiveLimit > 2000) {
              const oldestTime2 = b2[0][0];
              const b3Url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${binanceInterval}&limit=1000&endTime=${oldestTime2 - 1}`;
              const res3 = await fetch(b3Url);
              if (res3.ok) {
                const b3 = (await res3.json()) as [number, string, string, string, string, string][];
                raw = [...b3, ...raw];
              }
            }
          }
        }
      }
    } else {
      const binanceLimit = Math.min(1000, effectiveLimit);
      const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${binanceInterval}&limit=${binanceLimit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance klines failed with status ${res.status}`);
      raw = (await res.json()) as [number, string, string, string, string, string][];
    }

    let bars: OhlcvBar[] = raw.map((k) => {
      const d = new Date(k[0]);
      const timeStr = isIntraday
        ? d.toISOString().replace("T", " ").slice(0, 16)
        : d.toISOString().slice(0, 10);

      return {
        time: timeStr,
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      };
    });

    // If 1-Year candle resolution is requested, aggregate monthly candles into annual candles; if 4h, aggregate 1h into 4h
    if (isYear) {
      bars = aggregateBarsByYear(bars);
    } else if (interval.toLowerCase() === "4h") {
      bars = aggregateBarsByHour(bars, 4);
    }

    const enriched = enrichWithIndicators(bars);
    const last = enriched[enriched.length - 1];
    const prev = enriched[enriched.length - 2] ?? last;
    const changePct = prev && prev.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : 0;

    return {
      symbol: sym,
      interval,
      bars: enriched,
      currentPrice: last?.close ?? 0,
      change24hPct: changePct,
      stale: false,
    };
  }

  // 2. US Equities: Multi-Decade Historical Archive & Alpaca Engine
  // For 1-Year annual candles or multi-decade inception history, query Yahoo Finance archive (1984–2026)
  if (isYear) {
    try {
      const yahooMonthlyBars = await fetchYahooHistoricalBars(sym, "1mo", "max");
      if (yahooMonthlyBars.length > 0) {
        const yearlyBars = aggregateBarsByYear(yahooMonthlyBars);
        const enriched = enrichWithIndicators(yearlyBars);
        const last = enriched[enriched.length - 1];
        const prev = enriched[enriched.length - 2] ?? last;
        const changePct = prev && prev.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : 0;
        return {
          symbol: sym,
          interval,
          bars: enriched,
          currentPrice: last?.close ?? 0,
          change24hPct: changePct,
          stale: false,
        };
      }
    } catch (err) {
      logger.warn("CHART", `Yahoo finance annual bars failed for ${sym}, falling back to Alpaca`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // If range is ALL and interval is Monthly or Weekly, query Yahoo Finance for multi-decade data
  if (isAll && (isMonth || isWeek)) {
    try {
      const yahooBars = await fetchYahooHistoricalBars(sym, isMonth ? "1mo" : "1wk", "max");
      if (yahooBars.length > 0) {
        const enriched = enrichWithIndicators(yahooBars);
        const last = enriched[enriched.length - 1];
        const prev = enriched[enriched.length - 2] ?? last;
        const changePct = prev && prev.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : 0;
        return {
          symbol: sym,
          interval,
          bars: enriched,
          currentPrice: last?.close ?? 0,
          change24hPct: changePct,
          stale: false,
        };
      }
    } catch (err) {
      logger.warn("CHART", `Yahoo finance max history failed for ${sym}, falling back to Alpaca`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Query real Alpaca Historical Bars API
  const { isConfigured } = getAlpacaCredentials();
  if (isConfigured) {
    try {
      let alpacaTimeframe = "1Day";
      if (isMonth || isYear) {
        alpacaTimeframe = "1Month";
      } else if (isWeek) {
        alpacaTimeframe = "1Week";
      } else if (interval.toLowerCase() === "1m") {
        alpacaTimeframe = "1Min";
      } else if (interval.toLowerCase() === "5m") {
        alpacaTimeframe = "5Min";
      } else if (interval.toLowerCase() === "15m") {
        alpacaTimeframe = "15Min";
      } else if (interval.toLowerCase() === "30m") {
        alpacaTimeframe = "30Min";
      } else if (interval.toLowerCase() === "1h" || interval.toLowerCase() === "4h") {
        alpacaTimeframe = "1Hour";
      } else {
        alpacaTimeframe = "1Day";
      }

      const alpacaBars = await fetchHistoricalStockBars(sym, alpacaTimeframe, effectiveLimit, {
        isAll,
      });

      if (alpacaBars.length > 0) {
        let bars: OhlcvBar[] = alpacaBars.map((b) => {
          const timeStr = isIntraday
            ? b.t.replace("T", " ").slice(0, 16)
            : b.t.slice(0, 10);

          return {
            time: timeStr,
            open: b.o,
            high: b.h,
            low: b.l,
            close: b.c,
            volume: b.v,
          };
        });

        // If 1-Year candle resolution is requested, aggregate monthly bars into 1-year OHLCV bars; if 4h, aggregate 1h into 4h
        if (isYear) {
          bars = aggregateBarsByYear(bars);
        } else if (interval.toLowerCase() === "4h") {
          bars = aggregateBarsByHour(bars, 4);
        }

        const enriched = enrichWithIndicators(bars);
        const last = enriched[enriched.length - 1];
        const prev = enriched[enriched.length - 2] ?? last;
        const changePct = prev && prev.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : 0;

        return {
          symbol: sym,
          interval,
          bars: enriched,
          currentPrice: last?.close ?? 0,
          change24hPct: changePct,
          stale: false,
        };
      }
    } catch (err) {
      logger.error("CHART", `Failed to fetch Alpaca historical bars for ${sym}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback to Yahoo Finance for standard daily/weekly bars if Alpaca is unavailable
  try {
    const fallbackInterval = isMonth ? "1mo" : isWeek ? "1wk" : "1d";
    const fallbackRange = isAll ? "max" : "5y";
    const yahooFallbackBars = await fetchYahooHistoricalBars(sym, fallbackInterval, fallbackRange);
    if (yahooFallbackBars.length > 0) {
      const enriched = enrichWithIndicators(yahooFallbackBars);
      const last = enriched[enriched.length - 1];
      const prev = enriched[enriched.length - 2] ?? last;
      const changePct = prev && prev.close ? Math.round(((last.close - prev.close) / prev.close) * 10000) / 100 : 0;
      return {
        symbol: sym,
        interval,
        bars: enriched,
        currentPrice: last?.close ?? 0,
        change24hPct: changePct,
        stale: false,
      };
    }
  } catch {
    // ignore fallback error
  }

  throw new Error(`Chart data unavailable for ${sym}.`);
}
