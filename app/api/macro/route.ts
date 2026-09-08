import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getCached, setCached } from "@/lib/cache";
import { fetchFredSeries, searchFredSeries } from "@/lib/providers/fred";
import type { FredSeries } from "@/lib/providers/fred";

const TIMEOUT_MS = 5000;
// FRED series update monthly/quarterly at most — 1 hour TTL is conservative.
const SERIES_TTL_SECONDS = 3600;
// Search results change rarely too; 30 min is fine.
const SEARCH_TTL_SECONDS = 1800;

// Per-IP rate limiter — protects FRED quota from cache-stampedes / bots.
// Only active when Upstash credentials are present (same pattern as cache.ts).
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        analytics: false,
      })
    : null;

function withTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export async function GET(request: NextRequest) {
  // Per-IP rate limiting (task 2.1.9/2.1.10)
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

  const search = request.nextUrl.searchParams.get("search")?.trim();
  const seriesId = request.nextUrl.searchParams
    .get("series_id")
    ?.trim()
    .toUpperCase();

  if (!search && !seriesId) {
    return NextResponse.json(
      { error: "Provide search or series_id." },
      { status: 400 }
    );
  }

  // --- Series observations (most common path) ---
  if (seriesId) {
    const key = `macro:series:v2:${seriesId}`;
    const cached = await getCached<FredSeries>(key);

    if (cached && !cached.stale) {
      return NextResponse.json({ data: cached.value, stale: false });
    }

    const upstream = withTimeout();
    try {
      const data = await fetchFredSeries(seriesId, upstream.signal);
      await setCached(key, data, SERIES_TTL_SECONDS);
      return NextResponse.json({ data, stale: false });
    } catch {
      // Graceful degradation: serve last-cached data past TTL rather than breaking.
      if (cached) {
        return NextResponse.json({ data: cached.value, stale: true });
      }
      return NextResponse.json(
        { error: "FRED is unavailable or not configured." },
        { status: 503 }
      );
    } finally {
      upstream.clear();
    }
  }

  // --- Series search ---
  type SearchEntry = { id: string; title: string; units: string; frequency: string };
  const key = `macro:search:${search!.toLowerCase()}`;
  const cached = await getCached<SearchEntry[]>(key);

  if (cached && !cached.stale) {
    return NextResponse.json({ data: cached.value, stale: false });
  }

  const upstream = withTimeout();
  try {
    const data = await searchFredSeries(search!, upstream.signal);
    await setCached(key, data, SEARCH_TTL_SECONDS);
    return NextResponse.json({ data, stale: false });
  } catch {
    if (cached) {
      return NextResponse.json({ data: cached.value, stale: true });
    }
    return NextResponse.json(
      { error: "FRED is unavailable or not configured." },
      { status: 503 }
    );
  } finally {
    upstream.clear();
  }
}
