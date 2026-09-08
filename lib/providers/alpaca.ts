/**
 * Alpaca Market Data Provider (US Equities Quotes, Snapshots & Historical Bars)
 * Connects directly to Alpaca Market Data API v2 (IEX feed).
 * 
 * Strict Zero-Synthetic Policy: No artificial/generated depth levels or benchmark fallbacks.
 */

export type StockQuote = {
  symbol: string;
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  lastPrice: number;
  spread: number;
  spreadBps: number;
  timestamp: string;
};

export type StockSnapshot = {
  symbol: string;
  latestQuote: {
    bidPrice: number;
    bidSize: number;
    askPrice: number;
    askSize: number;
    timestamp: string;
  } | null;
  latestTrade: {
    price: number;
    size: number;
    timestamp: string;
  } | null;
  dailyBar: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: string;
  } | null;
  prevDailyBar: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: string;
  } | null;
  change: number;
  changePercent: number;
};

export type AlpacaBar = {
  t: string; // ISO Timestamp
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  v: number; // Volume
  n: number; // Number of trades
  vw: number; // Volume weighted average price
};

export function getAlpacaCredentials() {
  const apiKey = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || "").trim();
  const apiSecret = (process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || "").trim();
  return { apiKey, apiSecret, isConfigured: Boolean(apiKey && apiSecret) };
}

export function isEquitySymbol(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  // Crypto symbols typically end with USDT, BUSD, BTC, ETH or contain - / _
  if (s.endsWith("USDT") || s.endsWith("BUSD") || s.endsWith("BTC") || s.includes("-") || s.includes("/")) {
    return false;
  }
  // US Equity tickers are 1 to 5 alphabetic characters
  return /^[A-Z]{1,5}$/.test(s);
}

/**
 * Fetches latest real top-of-book stock quote from Alpaca IEX feed.
 * Throws on failure — zero synthetic data generated.
 */
export async function fetchStockQuote(symbol: string, signal?: AbortSignal): Promise<StockQuote> {
  const sym = symbol.trim().toUpperCase();
  const { apiKey, apiSecret, isConfigured } = getAlpacaCredentials();

  if (!isConfigured) {
    throw new Error("Alpaca API credentials not configured in environment (ALPACA_API_KEY / ALPACA_API_SECRET).");
  }

  const url = `https://data.alpaca.markets/v2/stocks/${sym}/quotes/latest?feed=iex`;
  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Alpaca Quote API error (${response.status}): ${errText || response.statusText}`);
  }

  const data = (await response.json()) as {
    quote: { bp: number; bs: number; ap: number; as: number; t: string };
  };

  const q = data.quote;
  const bidPrice = q.bp ?? 0;
  const askPrice = q.ap ?? 0;
  const mid = (bidPrice + askPrice) / 2;
  const spread = Math.max(0, askPrice - bidPrice);
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;

  return {
    symbol: sym,
    bidPrice,
    bidSize: q.bs ?? 0,
    askPrice,
    askSize: q.as ?? 0,
    lastPrice: mid,
    spread: parseFloat(spread.toFixed(4)),
    spreadBps: parseFloat(spreadBps.toFixed(2)),
    timestamp: q.t || new Date().toISOString(),
  };
}

/**
 * Fetches a single symbol snapshot from Alpaca (quote, trade, daily bar).
 */
export async function fetchStockSnapshot(symbol: string, signal?: AbortSignal): Promise<StockSnapshot> {
  const sym = symbol.trim().toUpperCase();
  const { apiKey, apiSecret, isConfigured } = getAlpacaCredentials();

  if (!isConfigured) {
    throw new Error("Alpaca API credentials not configured.");
  }

  const url = `https://data.alpaca.markets/v2/stocks/${sym}/snapshot?feed=iex`;
  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Alpaca Snapshot API error (${response.status}) for ${sym}`);
  }

  const raw = await response.json();
  return normalizeSnapshot(sym, raw);
}

/**
 * Fetches batched snapshots for multiple equity symbols in a single request.
 */
export async function fetchStockSnapshots(
  symbols: string[],
  signal?: AbortSignal
): Promise<Record<string, StockSnapshot>> {
  if (symbols.length === 0) return {};
  const { apiKey, apiSecret, isConfigured } = getAlpacaCredentials();

  if (!isConfigured) {
    throw new Error("Alpaca API credentials not configured.");
  }

  const cleanSymbols = symbols.map((s) => s.trim().toUpperCase()).join(",");
  const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${encodeURIComponent(cleanSymbols)}&feed=iex`;

  const response = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": apiKey,
      "APCA-API-SECRET-KEY": apiSecret,
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Alpaca Multi-Snapshot API error (${response.status})`);
  }

  const rawData = (await response.json()) as Record<string, any>;
  const result: Record<string, StockSnapshot> = {};

  for (const [sym, raw] of Object.entries(rawData)) {
    result[sym] = normalizeSnapshot(sym, raw);
  }

  return result;
}

/**
 * Fetches historical OHLCV bars from Alpaca for technical charts.
 */
export async function fetchHistoricalStockBars(
  symbol: string,
  timeframe: string = "1Day",
  limit: number = 90,
  options?: {
    startDate?: string;
    endDate?: string;
    isAll?: boolean;
    signal?: AbortSignal;
  }
): Promise<AlpacaBar[]> {
  const sym = symbol.trim().toUpperCase();
  const { apiKey, apiSecret, isConfigured } = getAlpacaCredentials();

  if (!isConfigured) {
    throw new Error("Alpaca API credentials not configured.");
  }

  const isIntraday = ["1Min", "5Min", "15Min", "30Min", "1Hour", "4Hour"].includes(timeframe);
  const isAll = options?.isAll ?? false;
  const effectiveLimit = Math.min(10000, Math.max(10, limit));

  let url: string;

  if (isIntraday) {
    // For intraday, dynamically determine lookback days so limits up to 10,000 can be satisfied
    let lookbackDays = 14;
    if (timeframe === "1Min") {
      lookbackDays = limit > 1000 ? 90 : 14;
    } else if (timeframe === "5Min") {
      lookbackDays = limit > 1000 ? 365 : 30;
    } else if (timeframe === "15Min" || timeframe === "30Min") {
      lookbackDays = limit > 1000 ? 730 : 90;
    } else if (timeframe === "1Hour" || timeframe === "4Hour") {
      lookbackDays = 1825; // 5 years
    }
    const start = new Date(Date.now() - lookbackDays * 86400000).toISOString().slice(0, 10);
    url = `https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=${encodeURIComponent(
      timeframe
    )}&start=${encodeURIComponent(start)}&limit=${effectiveLimit}&feed=iex&sort=desc`;
  } else if (isAll) {
    // For ALL / maximum history, query from 2015 with high limit
    const allLimit = timeframe === "1Month" ? 1000 : timeframe === "1Week" ? 2500 : 10000;
    url = `https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=${encodeURIComponent(
      timeframe
    )}&start=2015-01-01&limit=${allLimit}&feed=iex&sort=asc`;
  } else if (timeframe === "1Month" || timeframe === "1Week") {
    // For Month/Week, use start from 2015 with sort=desc to get the latest macro bars
    url = `https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=${encodeURIComponent(
      timeframe
    )}&start=2015-01-01&limit=${effectiveLimit}&feed=iex&sort=desc`;
  } else {
    // Daily bars with sort=desc to guarantee latest bars up to current session
    url = `https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=${encodeURIComponent(
      timeframe
    )}&start=2015-01-01&limit=${effectiveLimit}&feed=iex&sort=desc`;
  }

  const rawBars: AlpacaBar[] = [];
  let pageToken: string | undefined = undefined;
  const maxPages = effectiveLimit > 1000 ? 25 : effectiveLimit > 200 ? 6 : 1;
  let pagesFetched = 0;

  do {
    let pageUrl = url;
    if (pageToken) {
      pageUrl += `&page_token=${encodeURIComponent(pageToken)}`;
    }
    const response = await fetch(pageUrl, {
      headers: {
        "APCA-API-KEY-ID": apiKey,
        "APCA-API-SECRET-KEY": apiSecret,
        Accept: "application/json",
      },
      signal: options?.signal,
    });

    if (!response.ok) {
      if (rawBars.length > 0) break;
      throw new Error(`Alpaca Historical Bars API error (${response.status}) for ${sym}`);
    }

    const data = (await response.json()) as { bars?: AlpacaBar[]; next_page_token?: string | null };
    const pageBars = data.bars ?? [];
    if (pageBars.length === 0) break;

    rawBars.push(...pageBars);
    pagesFetched++;
    pageToken = data.next_page_token ?? undefined;

    if (rawBars.length >= effectiveLimit || !pageToken || pagesFetched >= maxPages) {
      break;
    }
  } while (pageToken && pagesFetched < maxPages);

  // If fetched with sort=desc, reverse into chronological order (asc) for chart rendering
  if (url.includes("sort=desc")) {
    return rawBars.reverse();
  }

  return rawBars;
}

function normalizeSnapshot(symbol: string, raw: any): StockSnapshot {
  const lq = raw.latestQuote;
  const lt = raw.latestTrade;
  const db = raw.dailyBar;
  const pb = raw.prevDailyBar;

  const currentPrice = lt?.p ?? (lq ? (lq.bp + lq.ap) / 2 : db?.c ?? 0);
  const prevClose = pb?.c ?? db?.o ?? currentPrice;
  const change = currentPrice && prevClose ? currentPrice - prevClose : 0;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  return {
    symbol,
    latestQuote: lq
      ? {
          bidPrice: lq.bp,
          bidSize: lq.bs,
          askPrice: lq.ap,
          askSize: lq.as,
          timestamp: lq.t,
        }
      : null,
    latestTrade: lt
      ? {
          price: lt.p,
          size: lt.s,
          timestamp: lt.t,
        }
      : null,
    dailyBar: db
      ? {
          open: db.o,
          high: db.h,
          low: db.l,
          close: db.c,
          volume: db.v,
          timestamp: db.t,
        }
      : null,
    prevDailyBar: pb
      ? {
          open: pb.o,
          high: pb.h,
          low: pb.l,
          close: pb.c,
          volume: pb.v,
          timestamp: pb.t,
        }
      : null,
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
  };
}
