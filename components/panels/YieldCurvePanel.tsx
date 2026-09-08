"use client";

import { useEffect, useState, type RefObject } from "react";
import type { YieldCurveData, YieldPoint } from "@/app/api/yield-curve/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

function buildSvgPath(
  points: YieldPoint[],
  key: "yield" | "monthAgoYield" | "yearAgoYield",
  width: number,
  height: number,
  pad: number,
  minY: number,
  maxY: number
): string {
  const valid = points.filter((p) => p[key] !== null);
  if (valid.length < 2) return "";

  const rangeY = maxY - minY || 0.01;
  const xs = valid.map((_, i) => pad + (i / (valid.length - 1)) * (width - pad * 2));
  const ys = valid.map((p) => height - pad - (((p[key] as number) - minY) / rangeY) * (height - pad * 2));

  return xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
}

function fmtBps(bps: number | null) {
  if (bps === null) return "N/A";
  const sign = bps > 0 ? "+" : "";
  return `${sign}${bps.toFixed(1)} bps`;
}

export default function YieldCurvePanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<YieldCurveData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [showMonthAgo, setShowMonthAgo] = useState(true);
  const [showYearAgo, setShowYearAgo] = useState(true);

  useEffect(() => {
    setStatus("loading");
    fetch("/api/yield-curve")
      .then((r) => r.json() as Promise<YieldCurveData & { error?: string }>)
      .then((d) => {
        if ("error" in d && d.error) throw new Error(d.error);
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, []);

  const W = 460, H = 140, PAD = 16;
  const points = data?.points ?? [];

  // Find min/max across current, 1M ago, and 1Y ago for consistent scale
  const allValues: number[] = [];
  points.forEach((p) => {
    if (p.yield !== null) allValues.push(p.yield);
    if (showMonthAgo && p.monthAgoYield !== null) allValues.push(p.monthAgoYield);
    if (showYearAgo && p.yearAgoYield !== null) allValues.push(p.yearAgoYield);
  });

  const minYield = allValues.length ? Math.floor(Math.min(...allValues) * 2) / 2 : 0;
  const maxYield = allValues.length ? Math.ceil(Math.max(...allValues) * 2) / 2 : 5;

  const todayPath = data ? buildSvgPath(points, "yield", W, H, PAD, minYield, maxYield) : "";
  const monthAgoPath = data && showMonthAgo ? buildSvgPath(points, "monthAgoYield", W, H, PAD, minYield, maxYield) : "";
  const yearAgoPath = data && showYearAgo ? buildSvgPath(points, "yearAgoYield", W, H, PAD, minYield, maxYield) : "";

  const regime = data?.regime ?? "NORMAL";
  const spreads = data?.spreads;

  return (
    <section
      className="yield-panel"
      aria-label="US Treasury yield curve analysis"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="YIELD // US TREASURY BENCHMARKS"
        title="US YIELD CURVE"
        subtitle={`REGIME: ${regime}`}
        sources="US TREASURY / FRED"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && <p className="news-empty">Loading yield curve & spreads…</p>}
        {status === "error" && !data && (
          <p className="news-empty">Yield curve unavailable. Check FRED_API_KEY.</p>
        )}

        {data && (
          <div>
            {/* Key Recession Spreads Bar */}
            <div className="yield-spreads-grid">
            <div className={`yield-spread-card${spreads?.t10y2y !== null && (spreads?.t10y2y ?? 0) < 0 ? " spread-inverted" : ""}`}>
              <span className="spread-name">10Y - 2Y SPREAD</span>
              <span className="spread-val">{fmtBps(spreads?.t10y2y ?? null)}</span>
              <span className="spread-tag">WALL ST RECESSION BENCHMARK</span>
            </div>
            <div className={`yield-spread-card${spreads?.t10y3m !== null && (spreads?.t10y3m ?? 0) < 0 ? " spread-inverted" : ""}`}>
              <span className="spread-name">10Y - 3M SPREAD</span>
              <span className="spread-val">{fmtBps(spreads?.t10y3m ?? null)}</span>
              <span className="spread-tag">FED RECESSION MODEL</span>
            </div>
            <div className="yield-spread-card">
              <span className="spread-name">30Y - 5Y SPREAD</span>
              <span className="spread-val">{fmtBps(spreads?.t30y5y ?? null)}</span>
              <span className="spread-tag">LONG-END STEEPNESS</span>
            </div>
          </div>

          {/* SVG Multi-Curve Overlay Chart */}
          <div className="yield-chart-wrap">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="US Treasury yield curve overlay chart"
              className="yield-svg"
            >
              {/* Y-axis gridlines & labels */}
              {[0, 0.5, 1].map((t) => {
                const y = PAD + (1 - t) * (H - PAD * 2);
                const label = (minYield + t * (maxYield - minYield)).toFixed(2);
                return (
                  <g key={t}>
                    <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="var(--border)" strokeWidth="1" />
                    <text x={PAD} y={y - 4} fill="var(--muted)" fontSize="8" textAnchor="start">
                      {label}%
                    </text>
                  </g>
                );
              })}

              {/* 1 Year Ago Curve (Muted dotted) */}
              {yearAgoPath && (
                <path
                  d={yearAgoPath}
                  fill="none"
                  stroke="#6b7280"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* 1 Month Ago Curve (Cyan dashed) */}
              {monthAgoPath && (
                <path
                  d={monthAgoPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Today's Curve (Solid yellow or red if inverted) */}
              {todayPath && (
                <path
                  d={todayPath}
                  fill="none"
                  stroke={regime === "INVERTED" ? "var(--ask)" : "var(--accent)"}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* Today's Data Points */}
              {points.filter((p) => p.yield !== null).map((p, i, arr) => {
                const rangeY = (maxYield - minYield) || 0.01;
                const x = PAD + (i / (arr.length - 1)) * (W - PAD * 2);
                const y = H - PAD - (((p.yield as number) - minYield) / rangeY) * (H - PAD * 2);
                return (
                  <circle
                    key={p.label}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r="3.5"
                    fill={regime === "INVERTED" ? "var(--ask)" : "var(--accent)"}
                  />
                );
              })}
            </svg>
          </div>

          {/* Curve Legend & Overlay Toggles */}
          <div className="yield-legend-bar">
            <span className="yield-legend-item">
              <span className="yield-swatch-today" /> TODAY ({data.asOf})
            </span>
            <button
              type="button"
              className={`yield-legend-btn${showMonthAgo ? " active-cyan" : ""}`}
              onClick={() => setShowMonthAgo(!showMonthAgo)}
            >
              <span className="yield-swatch-month" /> 1M AGO
            </button>
            <button
              type="button"
              className={`yield-legend-btn${showYearAgo ? " active-gray" : ""}`}
              onClick={() => setShowYearAgo(!showYearAgo)}
            >
              <span className="yield-swatch-year" /> 1Y AGO
            </button>
          </div>

          {/* Maturity Breakdown Table with BPS Changes */}
          <div className="yield-table">
            {points.map((p) => {
              const chg = p.dailyChangeBps;
              const isPos = chg !== null && chg > 0;
              const isNeg = chg !== null && chg < 0;
              return (
                <div key={p.label} className="yield-row">
                  <span className="yield-mat">{p.label}</span>
                  <span className="yield-val">
                    {p.yield !== null ? `${p.yield.toFixed(2)}%` : "N/A"}
                  </span>
                  <span className={`yield-bps ${isPos ? "wei-pos" : isNeg ? "wei-neg" : "wei-muted"}`}>
                    {chg !== null ? `${isPos ? "+" : ""}${chg.toFixed(1)} bps` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  </section>
);
}
