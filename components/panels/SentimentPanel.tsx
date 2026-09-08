"use client";

import { useEffect, useState, type RefObject } from "react";
import type { SentimentData, FngPoint } from "@/app/api/sentiment/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const GAUGE_COLORS: Record<string, string> = {
  "Extreme Fear": "#e25555",
  "Fear": "#e07a35",
  "Neutral": "#e0a835",
  "Greed": "#6ecf3e",
  "Extreme Greed": "#3ecf6e",
};

function classificationColor(c: string) {
  return GAUGE_COLORS[c] ?? "var(--accent)";
}

function gaugeArc(value: number) {
  const DEG = -140 + (value / 100) * 280;
  const RAD = (DEG * Math.PI) / 180;
  const cx = 60, cy = 60, r = 44;
  const x = cx + r * Math.cos(RAD);
  const y = cy + r * Math.sin(RAD);
  return { x: x.toFixed(1), y: y.toFixed(1) };
}

export default function SentimentPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<SentimentData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90 | 365>(30);
  const [hoveredPoint, setHoveredPoint] = useState<FngPoint | null>(null);

  useEffect(() => {
    setStatus("loading");
    fetch("/api/sentiment")
      .then((r) => r.json() as Promise<SentimentData & { error?: string }>)
      .then((d) => {
        if ("error" in d && d.error) throw new Error(d.error);
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, []);

  const current = data?.current;
  const history = data?.history ?? [];
  const color = current ? classificationColor(current.classification) : "var(--accent)";
  const needle = current ? gaugeArc(current.value) : null;

  // Selected history slice
  const slicedHistory = history.slice(0, rangeDays).reverse();
  const dist = data?.distribution30d;

  return (
    <section
      className="sentiment-panel"
      aria-label="Crypto Fear & Greed Index"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="FNG // MARKET PSYCHOLOGY"
        title="FEAR & GREED RADAR"
        subtitle={current ? `${current.value} · ${current.classification.toUpperCase()}` : undefined}
        sources="ALTERNATIVE.ME API"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && <p className="news-empty">Loading sentiment metrics…</p>}
        {status === "error" && !data && <p className="news-empty">Sentiment data unavailable.</p>}

        {current && (
          <div>
          {/* Multi-Period Benchmark Cards */}
          <div className="fng-benchmarks-grid">
            <div className="fng-bench-card fng-bench-now" style={{ borderColor: color }}>
              <span className="fng-bench-label">NOW</span>
              <span className="fng-bench-val" style={{ color }}>{current.value}</span>
              <span className="fng-bench-sub">{current.classification.toUpperCase()}</span>
            </div>
            {data.yesterday && (
              <div className="fng-bench-card">
                <span className="fng-bench-label">YESTERDAY</span>
                <span className="fng-bench-val">{data.yesterday.value}</span>
                <span className="fng-bench-sub">{data.yesterday.classification}</span>
              </div>
            )}
            {data.lastWeek && (
              <div className="fng-bench-card">
                <span className="fng-bench-label">7D AGO</span>
                <span className="fng-bench-val">{data.lastWeek.value}</span>
                <span className="fng-bench-sub">{data.lastWeek.classification}</span>
              </div>
            )}
            {data.lastMonth && (
              <div className="fng-bench-card">
                <span className="fng-bench-label">30D AGO</span>
                <span className="fng-bench-val">{data.lastMonth.value}</span>
                <span className="fng-bench-sub">{data.lastMonth.classification}</span>
              </div>
            )}
          </div>

          {/* Main Dial Gauge */}
          <div className="sentiment-gauge-wrap">
            <svg viewBox="0 0 120 70" className="sentiment-gauge" role="img" aria-label={`Fear & Greed: ${current.value}`}>
              {/* Background arc */}
              <path
                d="M16,60 A44,44 0 0,1 104,60"
                fill="none"
                stroke="var(--border)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Colored fill arc up to value */}
              <path
                d={`M16,60 A44,44 0 0,1 ${needle?.x ?? 60},${needle?.y ?? 16}`}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Score */}
              <text x="60" y="52" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>
                {current.value}
              </text>
            </svg>
            <div className="sentiment-label" style={{ color }}>
              {current.classification.toUpperCase()}
            </div>
            <div className="sentiment-date">AS OF {current.date}</div>
          </div>

          {/* 30-Day Distribution Bar */}
          {dist && (
            <div className="fng-dist-bar-wrap">
              <div className="fng-dist-header">
                <span>30-DAY REGIME DISTRIBUTION</span>
                <span>{dist.greedPct}% GREED · {dist.neutralPct}% NEUTRAL · {dist.fearPct}% FEAR</span>
              </div>
              <div className="fng-dist-progress">
                <div className="fng-dist-seg seg-greed" style={{ width: `${dist.greedPct}%` }} title={`Greed: ${dist.greedDays} days`} />
                <div className="fng-dist-seg seg-neutral" style={{ width: `${dist.neutralPct}%` }} title={`Neutral: ${dist.neutralDays} days`} />
                <div className="fng-dist-seg seg-fear" style={{ width: `${dist.fearPct}%` }} title={`Fear: ${dist.fearDays} days`} />
              </div>
            </div>
          )}

          {/* Timeframe History Range Selector */}
          <div className="fng-history-section">
            <div className="fng-history-header">
              <span>HISTORICAL TREND</span>
              <div className="fng-range-toggles">
                {([7, 30, 90, 365] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`fng-range-btn${rangeDays === days ? " range-active" : ""}`}
                    onClick={() => setRangeDays(days)}
                  >
                    {days === 365 ? "1Y" : `${days}D`}
                  </button>
                ))}
              </div>
            </div>

            {/* Hover tooltip readout */}
            <div className="fng-hover-readout">
              {hoveredPoint ? (
                <span>
                  <strong style={{ color: classificationColor(hoveredPoint.classification) }}>
                    {hoveredPoint.date}: {hoveredPoint.value} ({hoveredPoint.classification.toUpperCase()})
                  </strong>
                </span>
              ) : (
                <span className="wei-muted">Hover over chart to inspect daily score</span>
              )}
            </div>

            {/* Responsive Vector SVG Bar Chart (Prevents any 1Y breakout) */}
            <div className="sentiment-bars-svg-wrap" onMouseLeave={() => setHoveredPoint(null)}>
              <svg
                viewBox="0 0 400 50"
                preserveAspectRatio="none"
                className="sentiment-bars-svg"
                role="img"
                aria-label="Fear and greed historical trend"
              >
                {slicedHistory.map((h, i) => {
                  const n = slicedHistory.length;
                  const barW = Math.max(0.7, (400 / n) * 0.84);
                  const x = (i / n) * 400;
                  const barH = Math.max(4, (h.value / 100) * 46);
                  const y = 50 - barH;
                  const isHovered = hoveredPoint?.date === h.date;

                  return (
                    <rect
                      key={h.date}
                      x={x.toFixed(1)}
                      y={y.toFixed(1)}
                      width={barW.toFixed(1)}
                      height={barH.toFixed(1)}
                      fill={classificationColor(h.classification)}
                      opacity={isHovered ? 1 : 0.75}
                      rx={barW > 3 ? 1 : 0}
                      onMouseEnter={() => setHoveredPoint(h)}
                      style={{ cursor: "pointer" }}
                    />
                  );
                })}
              </svg>
            </div>
            <div className="sentiment-bar-labels">
              <span>{slicedHistory[0]?.date}</span>
              <span>{slicedHistory[slicedHistory.length - 1]?.date}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);
}
