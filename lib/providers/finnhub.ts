import type { NewsItem } from "./news";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

export async function fetchFinnhubNews(query: string, signal: AbortSignal): Promise<NewsItem[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY is not configured");

  const response = await fetch(`${FINNHUB_BASE}/news?category=general&token=${encodeURIComponent(token)}`, { signal });
  if (!response.ok) throw new Error(`Finnhub returned ${response.status}`);

  const items = (await response.json()) as {
    id?: number;
    headline?: string;
    source?: string;
    url?: string;
    datetime?: number;
    summary?: string;
  }[];

  const normalized = items
    .filter((item) => item.headline && item.url)
    .filter((item) => !query || `${item.headline} ${item.summary ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .map((item) => ({
      id: `finnhub-${item.id ?? item.url}`,
      title: item.headline!,
      source: item.source ?? "Finnhub",
      url: item.url!,
      timestamp: new Date((item.datetime ?? 0) * 1000).toISOString(),
      snippet: item.summary ?? "",
    }));

  return normalized;
}

export type FinnhubProfile2 = {
  country?: string;
  currency?: string;
  exchange?: string;
  finnhubIndustry?: string;
  ipo?: string;
  logo?: string;
  marketCapitalization?: number;
  name?: string;
  phone?: string;
  shareOutstanding?: number;
  ticker?: string;
  weburl?: string;
};

export async function fetchFinnhubProfile2(symbol: string, signal: AbortSignal): Promise<FinnhubProfile2 | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as FinnhubProfile2;
  } catch {
    return null;
  }
}

export type FinnhubRecommendation = {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
};

export async function fetchFinnhubRecommendations(symbol: string, signal: AbortSignal): Promise<FinnhubRecommendation[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return [];
    return (await res.json()) as FinnhubRecommendation[];
  } catch {
    return [];
  }
}

export type FinnhubPriceTarget = {
  lastUpdated?: string;
  symbol?: string;
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
  targetMedian?: number;
};

export async function fetchFinnhubPriceTarget(symbol: string, signal: AbortSignal): Promise<FinnhubPriceTarget | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as FinnhubPriceTarget;
  } catch {
    return null;
  }
}

export type FinnhubEarnings = {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number;
  surprise: number | null;
  surprisePercent: number | null;
  symbol: string;
  year: number;
};

export async function fetchFinnhubEarnings(symbol: string, signal: AbortSignal): Promise<FinnhubEarnings[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/earnings?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return [];
    return (await res.json()) as FinnhubEarnings[];
  } catch {
    return [];
  }
}

export type FinnhubQuote = {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High
  l: number; // Low
  o: number; // Open
  pc: number; // Previous close
  t: number; // Timestamp
};

export async function fetchFinnhubQuote(symbol: string, signal: AbortSignal): Promise<FinnhubQuote | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;

  try {
    const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return null;
    return (await res.json()) as FinnhubQuote;
  } catch {
    return null;
  }
}

export type FinnhubDividend = {
  date: string;
  amount: number;
  adjustedAmount?: number;
  payDate?: string;
  recordDate?: string;
  declarationDate?: string;
  currency?: string;
};

export async function fetchFinnhubDividends(symbol: string, signal: AbortSignal): Promise<FinnhubDividend[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];

  try {
    const from = "2020-01-01";
    const to = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${FINNHUB_BASE}/stock/dividend?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${token}`,
      { signal }
    );
    if (!res.ok) return [];
    return (await res.json()) as FinnhubDividend[];
  } catch {
    return [];
  }
}

export async function fetchFinnhubPeers(symbol: string, signal: AbortSignal): Promise<string[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return [];

  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${token}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data.filter((s): s is string => typeof s === "string" && s !== symbol);
    return [];
  } catch {
    return [];
  }
}

