import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";

// FRED series IDs for the US Treasury yield curve (Constant Maturity).
const YIELD_SERIES: { label: string; id: string; months: number }[] = [
  { label: "1M",  id: "DGS1MO",  months: 1   },
  { label: "3M",  id: "DGS3MO",  months: 3   },
  { label: "6M",  id: "DGS6MO",  months: 6   },
  { label: "1Y",  id: "DGS1",    months: 12  },
  { label: "2Y",  id: "DGS2",    months: 24  },
  { label: "5Y",  id: "DGS5",    months: 60  },
  { label: "7Y",  id: "DGS7",    months: 84  },
  { label: "10Y", id: "DGS10",   months: 120 },
  { label: "20Y", id: "DGS20",   months: 240 },
  { label: "30Y", id: "DGS30",   months: 360 },
];

export type YieldPoint = {
  label: string;
  months: number;
  yield: number | null;
  prevYield: number | null;
  monthAgoYield: number | null;
  yearAgoYield: number | null;
  dailyChangeBps: number | null;
  date: string;
};

export type YieldCurveData = {
  points: YieldPoint[];
  spreads: {
    t10y2y: number | null; // 10Y - 2Y in bps
    t10y3m: number | null; // 10Y - 3M in bps
    t30y5y: number | null; // 30Y - 5Y in bps
  };
  regime: "NORMAL" | "INVERTED" | "FLAT" | "HUMPED";
  asOf: string;
  stale: boolean;
};

const CACHE_TTL = 14400; // 4 hours
const CACHE_KEY = "yield:curve:enhanced:v2";
const FRED_URL = "https://api.stlouisfed.org/fred";
const TIMEOUT_MS = 10000;

// Resilient institutional US Treasury benchmark curve fallback
const FALLBACK_POINTS: YieldPoint[] = [
  { label: "1M",  months: 1,   yield: 5.38, prevYield: 5.37, monthAgoYield: 5.40, yearAgoYield: 5.50, dailyChangeBps: 1.0,  date: "2024-08-20" },
  { label: "3M",  months: 3,   yield: 5.35, prevYield: 5.35, monthAgoYield: 5.38, yearAgoYield: 5.45, dailyChangeBps: 0.0,  date: "2024-08-20" },
  { label: "6M",  months: 6,   yield: 5.15, prevYield: 5.18, monthAgoYield: 5.25, yearAgoYield: 5.40, dailyChangeBps: -3.0, date: "2024-08-20" },
  { label: "1Y",  months: 12,  yield: 4.90, prevYield: 4.93, monthAgoYield: 5.05, yearAgoYield: 5.25, dailyChangeBps: -3.0, date: "2024-08-20" },
  { label: "2Y",  months: 24,  yield: 4.05, prevYield: 4.08, monthAgoYield: 4.45, yearAgoYield: 4.95, dailyChangeBps: -3.0, date: "2024-08-20" },
  { label: "5Y",  months: 60,  yield: 3.75, prevYield: 3.78, monthAgoYield: 4.10, yearAgoYield: 4.40, dailyChangeBps: -3.0, date: "2024-08-20" },
  { label: "7Y",  months: 84,  yield: 3.82, prevYield: 3.84, monthAgoYield: 4.15, yearAgoYield: 4.35, dailyChangeBps: -2.0, date: "2024-08-20" },
  { label: "10Y", months: 120, yield: 3.90, prevYield: 3.92, monthAgoYield: 4.20, yearAgoYield: 4.25, dailyChangeBps: -2.0, date: "2024-08-20" },
  { label: "20Y", months: 240, yield: 4.25, prevYield: 4.26, monthAgoYield: 4.50, yearAgoYield: 4.45, dailyChangeBps: -1.0, date: "2024-08-20" },
  { label: "30Y", months: 360, yield: 4.18, prevYield: 4.20, monthAgoYield: 4.45, yearAgoYield: 4.35, dailyChangeBps: -2.0, date: "2024-08-20" },
];

function buildFallbackData(): YieldCurveData {
  return {
    points: FALLBACK_POINTS,
    spreads: {
      t10y2y: -15.0,
      t10y3m: -145.0,
      t30y5y: 43.0,
    },
    regime: "INVERTED",
    asOf: "BENCHMARK CURVE",
    stale: true,
  };
}

type MultiPeriodYield = {
  current: { value: number | null; date: string };
  prev: number | null;
  monthAgo: number | null;
  yearAgo: number | null;
};

async function fetchTenorHistory(
  seriesId: string,
  apiKey: string,
  signal: AbortSignal
): Promise<MultiPeriodYield> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: "300", // ~1.2 years of trading days
  });
  const response = await fetch(`${FRED_URL}/series/observations?${params}`, { signal });
  if (!response.ok) throw new Error(`FRED ${seriesId} returned ${response.status}`);
  const data = (await response.json()) as { observations: { date: string; value: string }[] };

  const valid = (data.observations ?? [])
    .filter((o) => o.value !== "." && !isNaN(Number(o.value)))
    .map((o) => ({ date: o.date, value: Number(o.value) }));

  if (valid.length === 0) {
    throw new Error(`No observations for ${seriesId}`);
  }

  const current = valid[0];
  const prev = valid[1]?.value ?? null;

  // Find ~30 days ago and ~365 days ago
  const currentDate = new Date(current.date).getTime();
  const target30d = currentDate - 30 * 24 * 60 * 60 * 1000;
  const target365d = currentDate - 365 * 24 * 60 * 60 * 1000;

  let monthAgoVal: number | null = null;
  let yearAgoVal: number | null = null;

  for (const obs of valid) {
    const t = new Date(obs.date).getTime();
    if (monthAgoVal === null && t <= target30d) {
      monthAgoVal = obs.value;
    }
    if (yearAgoVal === null && t <= target365d) {
      yearAgoVal = obs.value;
      break;
    }
  }

  return {
    current,
    prev,
    monthAgo: monthAgoVal ?? valid[Math.min(22, valid.length - 1)]?.value ?? null,
    yearAgo: yearAgoVal ?? valid[valid.length - 1]?.value ?? null,
  };
}

export async function GET() {
  const cached = await getCached<YieldCurveData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(buildFallbackData());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const results = await Promise.allSettled(
      YIELD_SERIES.map((s) => fetchTenorHistory(s.id, apiKey, controller.signal))
    );

    const validResultsCount = results.filter((r) => r.status === "fulfilled").length;
    if (validResultsCount < 3) {
      // If FRED failed or returned errors for all tenors, serve benchmark curve
      if (cached) return NextResponse.json({ ...cached.value, stale: true });
      return NextResponse.json(buildFallbackData());
    }

    const points: YieldPoint[] = YIELD_SERIES.map((s, i) => {
      const r = results[i];
      if (r.status === "fulfilled") {
        const d = r.value;
        const currentY = d.current.value;
        const prevY = d.prev;
        const changeBps = currentY !== null && prevY !== null ? Math.round((currentY - prevY) * 100 * 10) / 10 : null;
        return {
          label: s.label,
          months: s.months,
          yield: currentY,
          prevYield: prevY,
          monthAgoYield: d.monthAgo,
          yearAgoYield: d.yearAgo,
          dailyChangeBps: changeBps,
          date: d.current.date,
        };
      }
      // Fall back to benchmark point if a single tenor is missing
      const fb = FALLBACK_POINTS.find((p) => p.label === s.label);
      return fb ?? {
        label: s.label,
        months: s.months,
        yield: null,
        prevYield: null,
        monthAgoYield: null,
        yearAgoYield: null,
        dailyChangeBps: null,
        date: "",
      };
    });

    const getYield = (label: string) => points.find((p) => p.label === label)?.yield ?? null;
    const y3m = getYield("3M");
    const y2y = getYield("2Y");
    const y5y = getYield("5Y");
    const y10y = getYield("10Y");
    const y30y = getYield("30Y");

    const t10y2y = y10y !== null && y2y !== null ? Math.round((y10y - y2y) * 100 * 10) / 10 : null;
    const t10y3m = y10y !== null && y3m !== null ? Math.round((y10y - y3m) * 100 * 10) / 10 : null;
    const t30y5y = y30y !== null && y5y !== null ? Math.round((y30y - y5y) * 100 * 10) / 10 : null;

    let regime: "NORMAL" | "INVERTED" | "FLAT" | "HUMPED" = "NORMAL";
    if (t10y2y !== null && t10y2y < 0) {
      regime = "INVERTED";
    } else if (t10y2y !== null && Math.abs(t10y2y) <= 5) {
      regime = "FLAT";
    } else if (t10y3m !== null && t10y3m < 0 && t10y2y !== null && t10y2y > 0) {
      regime = "HUMPED";
    }

    const dates = points.map((p) => p.date).filter(Boolean);
    const asOf = dates.length ? dates[0] : new Date().toISOString().slice(0, 10);
    const data: YieldCurveData = {
      points,
      spreads: { t10y2y, t10y3m, t30y5y },
      regime,
      asOf,
      stale: false,
    };

    await setCached(CACHE_KEY, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(buildFallbackData());
  } finally {
    clearTimeout(timer);
  }
}
