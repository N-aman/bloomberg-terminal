import { NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";

const API_URL = "https://api.alternative.me/fng/?limit=365&format=json";
const CACHE_KEY = "sentiment:fng:365";
const CACHE_TTL = 3600; // 1-hour cache
const TIMEOUT_MS = 6000;

export type FngPoint = {
  value: number;
  classification: string;
  date: string; // ISO date string YYYY-MM-DD
};

export type SentimentData = {
  current: FngPoint;
  yesterday: FngPoint | null;
  lastWeek: FngPoint | null;
  lastMonth: FngPoint | null;
  history: FngPoint[]; // 365 days, newest first
  distribution30d: {
    greedDays: number;
    neutralDays: number;
    fearDays: number;
    greedPct: number;
    neutralPct: number;
    fearPct: number;
  };
  stale: boolean;
};

type AlternativeMeResponse = {
  data: { value: string; value_classification: string; timestamp: string }[];
};

export async function GET() {
  const cached = await getCached<SentimentData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`alternative.me returned ${response.status}`);

    const raw = (await response.json()) as AlternativeMeResponse;
    const points: FngPoint[] = (raw.data ?? []).map((d) => ({
      value: Number(d.value),
      classification: d.value_classification,
      date: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10),
    }));

    if (points.length === 0) throw new Error("Empty response from alternative.me");

    const current = points[0];
    const yesterday = points[1] ?? null;
    const lastWeek = points[7] ?? null;
    const lastMonth = points[30] ?? null;

    // Calculate 30-day distribution statistics
    const last30 = points.slice(0, 30);
    let greedDays = 0, neutralDays = 0, fearDays = 0;
    last30.forEach((p) => {
      if (p.value >= 55) greedDays++;
      else if (p.value <= 45) fearDays++;
      else neutralDays++;
    });

    const total = last30.length || 1;
    const distribution30d = {
      greedDays,
      neutralDays,
      fearDays,
      greedPct: Math.round((greedDays / total) * 100),
      neutralPct: Math.round((neutralDays / total) * 100),
      fearPct: Math.round((fearDays / total) * 100),
    };

    const data: SentimentData = {
      current,
      yesterday,
      lastWeek,
      lastMonth,
      history: points,
      distribution30d,
      stale: false,
    };

    await setCached(CACHE_KEY, data, CACHE_TTL);
    return NextResponse.json(data);
  } catch {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json({ error: "Sentiment data unavailable." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
