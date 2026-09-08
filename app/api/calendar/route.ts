import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchEconomicCalendar, type EconomicCalendarData } from "@/lib/providers/calendar";

const CACHE_TTL_SECONDS = 14400; // 4 hour TTL

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(7, Number(searchParams.get("days")) || 30));

  const CACHE_KEY = `calendar:events:v1:${days}`;
  const cached = await getCached<EconomicCalendarData>(CACHE_KEY);

  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  try {
    const data = await fetchEconomicCalendar(days);
    await setCached(CACHE_KEY, data, CACHE_TTL_SECONDS);
    return NextResponse.json(data);
  } catch {
    if (cached) return NextResponse.json({ ...cached.value, stale: true });
    return NextResponse.json(
      { error: "Economic calendar data currently unavailable." },
      { status: 503 }
    );
  }
}

