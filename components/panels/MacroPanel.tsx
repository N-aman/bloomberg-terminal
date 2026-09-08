"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { FredSeries } from "@/lib/providers/fred";

type SearchResult = Pick<FredSeries, "id" | "title" | "units" | "frequency">;

type MacroSeriesResponse = {
  data?: FredSeries;
  stale?: boolean;
  error?: string;
};

type MacroSearchResponse = {
  data?: SearchResult[];
  stale?: boolean;
  error?: string;
};

type MetricMode = "RAW" | "YOY";

const DEFAULT_SERIES = [
  { id: "GDP", label: "GDP" },
  { id: "CPIAUCSL", label: "CPI INFLATION" },
  { id: "UNRATE", label: "UNEMPLOYMENT" },
  { id: "FEDFUNDS", label: "FED FUNDS" },
  { id: "PAYEMS", label: "PAYROLLS" },
  { id: "WALCL", label: "FED ASSETS" },
  { id: "M2SL", label: "M2 MONEY" },
  { id: "T10Y2Y", label: "10Y-2Y SPREAD" },
];

// NBER US Business Cycle Recessions (Start, End)
const US_RECESSIONS = [
  { start: "1980-01-01", end: "1980-07-01", label: "1980 Energy" },
  { start: "1981-07-01", end: "1982-11-01", label: "1981-82 Volcker" },
  { start: "1990-07-01", end: "1991-03-01", label: "1990-91" },
  { start: "2001-03-01", end: "2001-11-01", label: "2001 Dot-Com" },
  { start: "2007-12-01", end: "2009-06-01", label: "2008 GFC" },
  { start: "2020-02-01", end: "2020-04-01", label: "2020 COVID" },
];

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

import PanelTitlebar from "@/components/ui/PanelTitlebar";

export default function MacroPanel({
  query: commandQuery = "",
  panelRef,
}: {
  query?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [selectedId, setSelectedId] = useState("CPIAUCSL");
  const [series, setSeries] = useState<FredSeries | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("loading");
  const [seriesStale, setSeriesStale] = useState(false);
  const [timeframe, setTimeframe] = useState<"1Y" | "5Y" | "10Y" | "MAX">("10Y");
  const [metricMode, setMetricMode] = useState<MetricMode>("RAW");
  const [hoveredObs, setHoveredObs] = useState<{ date: string; value: number } | null>(null);

  // Load series observations whenever selectedId changes
  useEffect(() => {
    setStatus("loading");
    setSeriesStale(false);
    setHoveredObs(null);
    fetch(`/api/macro?series_id=${selectedId}`)
      .then(async (response) => {
        const data = (await response.json()) as MacroSeriesResponse;
        if (!response.ok) throw new Error(data.error ?? "Macro request failed");
        return data;
      })
      .then((data) => {
        setSeries(data.data ?? null);
        setSeriesStale(data.stale === true);
        setStatus(data.stale ? "delayed" : "live");
      })
      .catch(() => {
        setSeries(null);
        setStatus("unavailable");
      });
  }, [selectedId]);

  // Trigger search when the command bar fires an ECON command
  useEffect(() => {
    if (!commandQuery) return;
    setQuery(commandQuery);
    runSearch(commandQuery);
  }, [commandQuery]);

  const runSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setStatus("searching");
    fetch(`/api/macro?query=${encodeURIComponent(searchQuery)}`)
      .then(async (response) => {
        const data = (await response.json()) as MacroSearchResponse;
        if (!response.ok) throw new Error(data.error ?? "Search failed");
        return data;
      })
      .then((data) => {
        setResults(data.data ?? []);
        setStatus("done");
      })
      .catch(() => {
        setResults([]);
        setStatus("unavailable");
      });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // Compute dataset based on metricMode (RAW vs YOY % change) and timeframe
  const processedObs = useMemo<{ date: string; value: number }[]>(() => {
    if (!series?.observations || series.observations.length === 0) return [];

    const validObs: { date: string; value: number }[] = series.observations
      .filter((o): o is { date: string; value: number } => o.value !== null && typeof o.value === "number" && !isNaN(o.value));

    if (validObs.length === 0) return [];

    let baseDataset = validObs;

    if (metricMode === "YOY") {
      const isQuarterly = series.frequency?.toLowerCase().includes("quarter");
      const lag = isQuarterly ? 4 : 12;

      const yoyObs: { date: string; value: number }[] = [];
      for (let i = lag; i < validObs.length; i++) {
        const current = validObs[i].value;
        const previous = validObs[i - lag].value;
        if (previous !== 0) {
          const pctChange = ((current - previous) / Math.abs(previous)) * 100;
          yoyObs.push({ date: validObs[i].date, value: Math.round(pctChange * 100) / 100 });
        }
      }
      baseDataset = yoyObs.length > 0 ? yoyObs : validObs;
    }

    // Filter by selected timeframe from the newest observation backwards
    if (timeframe === "MAX") return baseDataset;

    const years = timeframe === "1Y" ? 1 : timeframe === "5Y" ? 5 : 10;
    const lastDate = new Date(baseDataset[baseDataset.length - 1].date).getTime();
    const cutoff = lastDate - years * 365.25 * 24 * 60 * 60 * 1000;
    const filtered = baseDataset.filter((o) => new Date(o.date).getTime() >= cutoff);

    return filtered.length > 0 ? filtered : baseDataset;
  }, [series, timeframe, metricMode]);

  // SVG dimensions
  const W = 520, H = 160, PAD_X = 28, PAD_Y = 16;
  const values = processedObs.map((o) => o.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  const points = processedObs
    .map((obs, index) => {
      const x = processedObs.length > 1 ? PAD_X + (index / (processedObs.length - 1)) * (W - PAD_X * 2) : W / 2;
      const y = H - PAD_Y - ((obs.value - min) / range) * (H - PAD_Y * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Recession shading bands across the historical window
  const recessionBands = useMemo(() => {
    if (processedObs.length < 2) return [];
    const firstDate = new Date(processedObs[0].date).getTime();
    const lastDate = new Date(processedObs[processedObs.length - 1].date).getTime();
    const totalSpan = lastDate - firstDate || 1;

    return US_RECESSIONS.map((rec) => {
      const rStart = new Date(rec.start).getTime();
      const rEnd = new Date(rec.end).getTime();

      if (rEnd < firstDate || rStart > lastDate) return null;

      const clampedStart = Math.max(rStart, firstDate);
      const clampedEnd = Math.min(rEnd, lastDate);

      const x1 = PAD_X + ((clampedStart - firstDate) / totalSpan) * (W - PAD_X * 2);
      const x2 = PAD_X + ((clampedEnd - firstDate) / totalSpan) * (W - PAD_X * 2);

      return { x: x1, width: Math.max(3, x2 - x1), label: rec.label };
    }).filter(Boolean) as { x: number; width: number; label: string }[];
  }, [processedObs]);

  const latestObs = processedObs[processedObs.length - 1];

  return (
    <section
      className="macro-panel"
      aria-label="Macroeconomic series intelligence"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="MACRO // FRED INTELLIGENCE"
        title={series?.title ?? "MACROECONOMIC SERIES"}
        subtitle={selectedId}
        sources="ST. LOUIS FED (FRED)"
        status={seriesStale ? "stale" : status === "live" ? "live" : "loading"}
      />

      <div className="panel-content-body">
        {/* Preset Series Buttons */}
        <div className="macro-defaults">
          {DEFAULT_SERIES.map((item) => (
            <button
              className={selectedId === item.id ? "macro-selected" : ""}
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

      {/* Search Input */}
      <form className="macro-search" onSubmit={handleSearch}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SEARCH 800,000+ FRED ECONOMIC SERIES (e.g. M2, Housing, Payrolls)..."
          aria-label="Search FRED series"
        />
        <button type="submit">SEARCH</button>
      </form>

      {/* Search Results */}
      {results.length > 0 ? (
        <div className="macro-results">
          {results.map((result) => (
            <button
              type="button"
              key={result.id}
              onClick={() => {
                setSelectedId(result.id);
                setResults([]);
              }}
            >
              {result.id} / {result.title}
            </button>
          ))}
        </div>
      ) : null}

      {series && processedObs.length > 0 ? (
        <>
          {/* Controls Bar: Timeframe & Clean 2-Way View Switcher */}
          <div className="macro-controls-bar">
            {/* Timeframe selector */}
            <div className="macro-toggles-group">
              {(["1Y", "5Y", "10Y", "MAX"] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={`macro-tf-btn${timeframe === tf ? " macro-tf-active" : ""}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* 2-Way Mode Switch: [ RAW LEVEL ] vs [ YoY % CHANGE ] */}
            <div className="macro-toggles-group">
              <button
                type="button"
                className={`macro-tf-btn${metricMode === "RAW" ? " macro-tf-active" : ""}`}
                onClick={() => setMetricMode("RAW")}
                title="Display raw series level with historical recession context"
              >
                RAW LEVEL
              </button>
              <button
                type="button"
                className={`macro-tf-btn${metricMode === "YOY" ? " macro-tf-active" : ""}`}
                onClick={() => setMetricMode("YOY")}
                title="Display Year-over-Year percentage change"
              >
                YoY % CHANGE
              </button>
            </div>
          </div>

          {/* Value Readout & Crosshair Track */}
          <div className="macro-readout-bar">
            {hoveredObs ? (
              <span className="macro-readout-val">
                <strong style={{ color: "var(--accent)" }}>{hoveredObs.date}:</strong> {fmt(hoveredObs.value)} {metricMode === "YOY" ? "% (YoY)" : series.units}
              </span>
            ) : latestObs ? (
              <span className="macro-readout-val">
                <strong>LATEST ({latestObs.date}):</strong> {fmt(latestObs.value)} {metricMode === "YOY" ? "% (YoY)" : series.units}
              </span>
            ) : null}
          </div>

          {/* Interactive SVG Chart */}
          <div className="macro-chart-wrap" onMouseLeave={() => setHoveredObs(null)}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${series.title} chart`}
              className="macro-svg"
            >
              {/* NBER US Recession Shading Bands */}
              {recessionBands.map((r, i) => (
                <rect
                  key={i}
                  x={r.x.toFixed(1)}
                  y={PAD_Y}
                  width={r.width.toFixed(1)}
                  height={H - PAD_Y * 2}
                  fill="#ffffff"
                  fillOpacity="0.10"
                />
              ))}

              {/* Gridlines & Y-Axis values */}
              {[0, 0.5, 1].map((t) => {
                const y = PAD_Y + (1 - t) * (H - PAD_Y * 2);
                const label = (min + t * range).toFixed(1);
                return (
                  <g key={t}>
                    <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="var(--border)" strokeWidth="1" />
                    <text x={PAD_X - 4} y={y + 3} fill="var(--muted)" fontSize="8" textAnchor="end">
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Zero baseline for YoY % */}
              {metricMode === "YOY" && min < 0 && max > 0 && (
                <line
                  x1={PAD_X}
                  y1={H - PAD_Y - ((0 - min) / range) * (H - PAD_Y * 2)}
                  x2={W - PAD_X}
                  y2={H - PAD_Y - ((0 - min) / range) * (H - PAD_Y * 2)}
                  stroke="var(--muted)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              )}

              {/* Series Polyline */}
              <polyline
                points={points}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />

              {/* Hover tracking hotspots */}
              {processedObs.map((obs, idx) => {
                const x = processedObs.length > 1 ? PAD_X + (idx / (processedObs.length - 1)) * (W - PAD_X * 2) : W / 2;
                const y = H - PAD_Y - ((obs.value - min) / range) * (H - PAD_Y * 2);
                const isHovered = hoveredObs?.date === obs.date;
                return (
                  <g key={obs.date}>
                    {isHovered && (
                      <>
                        <line x1={x} y1={PAD_Y} x2={x} y2={H - PAD_Y} stroke="var(--accent)" strokeWidth="1" strokeDasharray="2 2" />
                        <circle cx={x} cy={y} r="4" fill="var(--accent)" />
                      </>
                    )}
                    <rect
                      x={x - (W / processedObs.length) / 2}
                      y={PAD_Y}
                      width={Math.max(4, W / processedObs.length)}
                      height={H - PAD_Y * 2}
                      fill="transparent"
                      onMouseEnter={() => setHoveredObs(obs)}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="macro-meta">
            <span>{metricMode === "YOY" ? "YEAR-OVER-YEAR % CHANGE" : series.units}</span>
            <span>{series.frequency}</span>
            <span>UPDATED {series.lastUpdated}</span>
          </div>
        </>
      ) : status !== "loading" && status !== "searching" ? (
        <p className="news-empty">Macro data unavailable. Check FRED_API_KEY.</p>
      ) : (
        <p className="news-empty">Loading macroeconomic data…</p>
      )}
      </div>
    </section>
  );
}
