import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getCached, setCached } from "@/lib/cache";
import { fetchCurrentsNews } from "@/lib/providers/currents";
import { fetchFinnhubNews } from "@/lib/providers/finnhub";
import type { NewsItem } from "@/lib/providers/news";

const CACHE_TTL_SECONDS = 120;
const UPSTREAM_TIMEOUT_MS = 5000;

export type EnrichedNewsItem = NewsItem & {
  category?: "TECH" | "MACRO" | "FX" | "CRYPTO" | "ENERGY" | "GENERAL";
};

// Per-IP rate limiter — only active when Upstash credentials are present.
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: false,
      })
    : null;

function cacheKey(query: string, category: string) {
  return `news:${category.toLowerCase()}:${query.toLowerCase() || "general"}`;
}

function withTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function classifyNewsCategory(title: string, snippet: string): "TECH" | "MACRO" | "FX" | "CRYPTO" | "ENERGY" | "GENERAL" {
  const text = `${title} ${snippet}`.toUpperCase();
  if (/BITCOIN|ETHEREUM|CRYPTO|BTC|ETH|SOLANA|BLOCKCHAIN|BINANCE|COINBASE/.test(text)) return "CRYPTO";
  if (/CRUDE|OIL|BRENT|WTI|GAS|OPEC|ENERGY|BARREL|PETROLEUM/.test(text)) return "ENERGY";
  if (/DOLLAR|EURO|YEN|CURRENCY|EXCHANGE RATE|FOREX|POUND|FX|DEVALUATION/.test(text)) return "FX";
  if (/FED|INFLATION|CPI|JOBS|RATE HIKE|RATE CUT|POWELL|TREASURY|YIELD|GDP|FOMC|RECESSION/.test(text)) return "MACRO";
  if (/AI|NVIDIA|APPLE|MICROSOFT|TECH|CHIP|SEMICONDUCTOR|SOFTWARE|META|GOOGLE|ALPHABET|AMAZON/.test(text)) return "TECH";
  return "GENERAL";
}

export async function GET(request: NextRequest) {
  if (ratelimit) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "127.0.0.1";
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before retrying." },
        { status: 429 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || searchParams.get("query") || "").trim();
  const categoryParam = (searchParams.get("category") || "ALL").trim().toUpperCase();

  const key = cacheKey(query, categoryParam);
  const cached = await getCached<EnrichedNewsItem[]>(key);

  if (cached && !cached.stale) {
    return NextResponse.json({ items: cached.value, provider: "cache", stale: false });
  }

  try {
    let rawItems: NewsItem[] = [];
    let provider: "finnhub" | "currents" = "finnhub";

    try {
      const upstream = withTimeout();
      try {
        rawItems = await fetchFinnhubNews(query, upstream.signal);
      } finally {
        upstream.clear();
      }
    } catch {
      const fallback = withTimeout();
      try {
        rawItems = await fetchCurrentsNews(query, fallback.signal);
      } finally {
        fallback.clear();
      }
      provider = "currents";
    }

    // Enrich items with institutional topic classifier
    let enrichedItems: EnrichedNewsItem[] = rawItems.map((item) => ({
      ...item,
      category: classifyNewsCategory(item.title, item.snippet),
    }));

    // Filter by channel category if specified
    if (categoryParam !== "ALL") {
      enrichedItems = enrichedItems.filter((item) => item.category === categoryParam);
    }

    await setCached(key, enrichedItems, CACHE_TTL_SECONDS);
    return NextResponse.json({ items: enrichedItems, provider, stale: false, simulated: false });
  } catch {
    if (cached) {
      return NextResponse.json({ items: cached.value, provider: "cache", stale: true, simulated: false });
    }

    // Realistic fallback news feed if offline (explicitly labeled as simulated)
    const fallbackItems: EnrichedNewsItem[] = [
      {
        id: "fb-1",
        title: "Fed Signals Measured Approach to Future Policy Adjustments Amid Inflation Trends",
        source: "Simulated Wire",
        url: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        snippet: "Federal Reserve officials highlighted continued vigilance on economic indicators while monitoring labor market strength.",
        category: "MACRO",
      },
      {
        id: "fb-2",
        title: "Semiconductor Manufacturers Expand Advanced Packaging Capacity for Enterprise AI",
        source: "Simulated Wire",
        url: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
        snippet: "Key foundries accelerate capital expenditure plans to meet accelerating high-bandwidth memory and accelerator demand.",
        category: "TECH",
      },
      {
        id: "fb-3",
        title: "Global Crude Benchmarks Fluctuate Following Supply Guidance and Shipping Reports",
        source: "Simulated Wire",
        url: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
        snippet: "Crude futures saw active consolidation as inventories aligned with mid-quarter consensus estimates.",
        category: "ENERGY",
      },
      {
        id: "fb-4",
        title: "US Dollar Index Consolidates Across Major Trading Pairs Ahead of Central Bank Speeches",
        source: "Simulated Wire",
        url: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 80).toISOString(),
        snippet: "Currency cross-rates showed tight dispersion as European and Asian sessions traded within key support levels.",
        category: "FX",
      },
      {
        id: "fb-5",
        title: "Digital Asset Inflows Strengthen as Institutional Custody Adoption Reaches Milestones",
        source: "Simulated Wire",
        url: "#",
        timestamp: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
        snippet: "Weekly institutional fund flows registered net gains across benchmark exchange-traded products.",
        category: "CRYPTO",
      },
    ];

    const filtered =
      categoryParam !== "ALL"
        ? fallbackItems.filter((i) => i.category === categoryParam)
        : fallbackItems;

    return NextResponse.json({ items: filtered, provider: "fallback", stale: true, simulated: true });
  }
}
