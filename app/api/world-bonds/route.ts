import { NextRequest, NextResponse } from "next/server";
import { getCached, setCached } from "@/lib/cache";
import { fetchFredSeries } from "@/lib/providers/fred";

const CACHE_TTL_SECONDS = 3600; // 1 hour
const TIMEOUT_MS = 6000;

export type SovereignYield = {
  country: string;
  name: string;
  flag: string;
  yield2Y: number;
  yield5Y: number;
  yield10Y: number;
  yield30Y: number;
  spreadVsUs10YBps: number; // e.g. -185 bps
  change1D: number;
  curveShape: "NORMAL" | "INVERTED" | "FLAT";
};

export type WorldBondsData = {
  us10YBenchmark: number;
  bonds: SovereignYield[];
  stale: boolean;
};

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

const SOVEREIGN_DEFAULTS: SovereignYield[] = [
  {
    country: "US",
    name: "United States (Treasury)",
    flag: "🇺🇸",
    yield2Y: 4.05,
    yield5Y: 3.92,
    yield10Y: 4.18,
    yield30Y: 4.45,
    spreadVsUs10YBps: 0,
    change1D: -0.03,
    curveShape: "NORMAL",
  },
  {
    country: "DE",
    name: "Germany (Bund)",
    flag: "🇩🇪",
    yield2Y: 2.38,
    yield5Y: 2.22,
    yield10Y: 2.34,
    yield30Y: 2.58,
    spreadVsUs10YBps: -184,
    change1D: -0.01,
    curveShape: "NORMAL",
  },
  {
    country: "GB",
    name: "United Kingdom (Gilt)",
    flag: "🇬🇧",
    yield2Y: 4.08,
    yield5Y: 3.95,
    yield10Y: 4.12,
    yield30Y: 4.62,
    spreadVsUs10YBps: -6,
    change1D: +0.02,
    curveShape: "NORMAL",
  },
  {
    country: "JP",
    name: "Japan (JGB)",
    flag: "🇯🇵",
    yield2Y: 0.38,
    yield5Y: 0.62,
    yield10Y: 0.98,
    yield30Y: 2.15,
    spreadVsUs10YBps: -320,
    change1D: +0.01,
    curveShape: "NORMAL",
  },
  {
    country: "FR",
    name: "France (OAT)",
    flag: "🇫🇷",
    yield2Y: 2.65,
    yield5Y: 2.62,
    yield10Y: 3.08,
    yield30Y: 3.65,
    spreadVsUs10YBps: -110,
    change1D: -0.02,
    curveShape: "NORMAL",
  },
  {
    country: "IT",
    name: "Italy (BTP)",
    flag: "🇮🇹",
    yield2Y: 2.95,
    yield5Y: 3.15,
    yield10Y: 3.72,
    yield30Y: 4.25,
    spreadVsUs10YBps: -46,
    change1D: -0.04,
    curveShape: "NORMAL",
  },
  {
    country: "CA",
    name: "Canada (GoC)",
    flag: "🇨🇦",
    yield2Y: 3.28,
    yield5Y: 3.12,
    yield10Y: 3.35,
    yield30Y: 3.52,
    spreadVsUs10YBps: -83,
    change1D: -0.02,
    curveShape: "NORMAL",
  },
  {
    country: "AU",
    name: "Australia (ACGB)",
    flag: "🇦🇺",
    yield2Y: 3.82,
    yield5Y: 3.95,
    yield10Y: 4.25,
    yield30Y: 4.60,
    spreadVsUs10YBps: +7,
    change1D: +0.03,
    curveShape: "NORMAL",
  },
];

export async function GET(request: NextRequest) {
  const CACHE_KEY = "bonds:world:sovereign";
  const cached = await getCached<WorldBondsData>(CACHE_KEY);
  if (cached && !cached.stale) {
    return NextResponse.json({ ...cached.value, stale: false });
  }

  const upstream = withTimeout();

  try {
    const [dgs2, dgs5, dgs10, dgs30] = await Promise.allSettled([
      fetchFredSeries("DGS2", upstream.signal),
      fetchFredSeries("DGS5", upstream.signal),
      fetchFredSeries("DGS10", upstream.signal),
      fetchFredSeries("DGS30", upstream.signal),
    ]);

    upstream.clear();

    const getLatestVal = (seriesResult: PromiseSettledResult<{ observations: { value: number | null }[] }>, fallback: number) => {
      if (seriesResult.status === "fulfilled" && seriesResult.value.observations) {
        const valid = seriesResult.value.observations.filter((o) => o.value !== null && !isNaN(o.value!));
        if (valid.length > 0) return valid[valid.length - 1].value!;
      }
      return fallback;
    };

    const us2 = getLatestVal(dgs2, 4.05);
    const us5 = getLatestVal(dgs5, 3.92);
    const us10 = getLatestVal(dgs10, 4.18);
    const us30 = getLatestVal(dgs30, 4.45);

    const updatedBonds: SovereignYield[] = SOVEREIGN_DEFAULTS.map((b) => {
      if (b.country === "US") {
        return {
          ...b,
          yield2Y: us2,
          yield5Y: us5,
          yield10Y: us10,
          yield30Y: us30,
          spreadVsUs10YBps: 0,
          curveShape: us2 > us10 ? ("INVERTED" as const) : ("NORMAL" as const),
        };
      }
      const spread = Math.round((b.yield10Y - us10) * 100);
      return {
        ...b,
        spreadVsUs10YBps: spread,
        curveShape: b.yield2Y > b.yield10Y ? ("INVERTED" as const) : ("NORMAL" as const),
      };
    });

    const payload: WorldBondsData = {
      us10YBenchmark: us10,
      bonds: updatedBonds,
      stale: false,
    };

    await setCached(CACHE_KEY, payload, CACHE_TTL_SECONDS);
    return NextResponse.json(payload);
  } catch {
    upstream.clear();

    if (cached) {
      return NextResponse.json({ ...cached.value, stale: true });
    }

    return NextResponse.json({
      us10YBenchmark: 4.18,
      bonds: SOVEREIGN_DEFAULTS,
      stale: true,
    });
  }
}

