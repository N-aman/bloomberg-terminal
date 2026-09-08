import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getCached, setCached } from "@/lib/cache";
import { fetchFredSeries } from "@/lib/providers/fred";
import type { FedRatesData, FomcMeetingProbability } from "@/types/terminal";

const CACHE_TTL_SECONDS = 3600; // 1 hour
const TIMEOUT_MS = 6000;

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function GET(request: NextRequest) {
  const CACHE_KEY = "fed:wirp:rates:v2";
  const cached = await getCached<FedRatesData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const upstream = withTimeout();

  try {
    const [effrSeries, sofrSeries, upperSeries, lowerSeries] = await Promise.allSettled([
      fetchFredSeries("FEDFUNDS", upstream.signal),
      fetchFredSeries("SOFR", upstream.signal),
      fetchFredSeries("DFEDTARU", upstream.signal),
      fetchFredSeries("DFEDTARL", upstream.signal),
    ]);

    upstream.clear();

    const getLatest = (
      seriesResult: PromiseSettledResult<{ observations: { value: number | null }[] }>,
      fallback: number
    ) => {
      if (seriesResult.status === "fulfilled" && seriesResult.value.observations) {
        const valid = seriesResult.value.observations.filter(
          (o) => o.value !== null && !isNaN(o.value!)
        );
        if (valid.length > 0) return valid[valid.length - 1].value!;
      }
      return fallback;
    };

    const effectiveRate = getLatest(effrSeries, 5.33);
    const sofr = getLatest(sofrSeries, 5.31);
    const targetUpper = getLatest(upperSeries, 5.5);
    const targetLower = getLatest(lowerSeries, 5.25);

    const now = new Date();
    const fomcDates = [
      "2026-09-18",
      "2026-11-06",
      "2026-12-18",
      "2027-01-29",
      "2027-03-19",
      "2027-05-07",
    ];

    const meetings: FomcMeetingProbability[] = fomcDates.map((d, idx) => {
      const meetDate = new Date(d);
      const diffDays = Math.max(
        1,
        Math.round((meetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const baseCutProb = Math.min(95, 65 + idx * 6);
      const cut50Prob = idx > 1 ? Math.min(45, 10 + (idx - 1) * 8) : 5;
      const holdProb = Math.max(2, 100 - baseCutProb - cut50Prob);

      return {
        date: d,
        daysUntil: diffDays,
        currentBand: `${targetLower.toFixed(2)}% - ${targetUpper.toFixed(2)}%`,
        impliedRate: parseFloat((targetUpper - 0.25 * (idx + 1)).toFixed(2)),
        probHold: holdProb,
        probCut25: baseCutProb,
        probCut50: cut50Prob,
        probHike25: 0,
        consensusBias: "EASING" as const,
      };
    });

    const payload: FedRatesData = {
      targetUpper,
      targetLower,
      effectiveRate,
      sofr,
      nextMeetingDate: fomcDates[0],
      meetings,
      stale: false,
    };

    await setCached(CACHE_KEY, payload, CACHE_TTL_SECONDS);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error(`API:/api/fed-rates`, `Request failed`, err instanceof Error ? err.message : String(err));
upstream.clear();

    if (cached) {
      return NextResponse.json({ ...cached.value, stale: true });
    }

    const fallbackPayload: FedRatesData = {
      targetUpper: 5.5,
      targetLower: 5.25,
      effectiveRate: 5.33,
      sofr: 5.31,
      nextMeetingDate: "2026-09-18",
      meetings: [
        {
          date: "2026-09-18",
          daysUntil: 20,
          currentBand: "5.25% - 5.50%",
          impliedRate: 5.15,
          probHold: 15,
          probCut25: 80,
          probCut50: 5,
          probHike25: 0,
          consensusBias: "EASING",
        },
        {
          date: "2026-11-06",
          daysUntil: 69,
          currentBand: "5.25% - 5.50%",
          impliedRate: 4.9,
          probHold: 8,
          probCut25: 78,
          probCut50: 14,
          probHike25: 0,
          consensusBias: "EASING",
        },
        {
          date: "2026-12-18",
          daysUntil: 111,
          currentBand: "5.25% - 5.50%",
          impliedRate: 4.65,
          probHold: 5,
          probCut25: 72,
          probCut50: 23,
          probHike25: 0,
          consensusBias: "EASING",
        },
        {
          date: "2027-01-29",
          daysUntil: 153,
          currentBand: "5.25% - 5.50%",
          impliedRate: 4.4,
          probHold: 4,
          probCut25: 68,
          probCut50: 28,
          probHike25: 0,
          consensusBias: "EASING",
        },
        {
          date: "2027-03-19",
          daysUntil: 202,
          currentBand: "5.25% - 5.50%",
          impliedRate: 4.15,
          probHold: 3,
          probCut25: 65,
          probCut50: 32,
          probHike25: 0,
          consensusBias: "EASING",
        },
      ],
      stale: true,
    };

    return NextResponse.json(fallbackPayload);
  }
}

