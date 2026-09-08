"use client";

import { useEffect, useState, useMemo, type RefObject } from "react";
import type { CommoditiesData, CommodityItem, CommodityCategory } from "@/app/api/commodities/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

function renderSparkline(points: number[], isUp: boolean) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 90;
  const height = 26;

  const svgPoints = points
    .map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        fill="none"
        stroke={isUp ? "var(--bid)" : "var(--ask)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={svgPoints}
      />
    </svg>
  );
}

const CATEGORIES = [
  "ALL",
  "Energy",
  "Precious Metals",
  "Industrial Metals",
  "Agriculture & Softs",
] as const;

export default function CommoditiesPanel({
  initialQuery = "",
  panelRef,
  onSelectCommodity,
}: {
  initialQuery?: string;
  panelRef?: RefObject<HTMLElement | null>;
  onSelectCommodity?: (ticker: string) => void;
}) {
  const [data, setData] = useState<CommoditiesData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState<"default" | "movers" | "price">("default");

  useEffect(() => {
    if (initialQuery) setSearchQuery(initialQuery);
  }, [initialQuery]);

  const loadData = () => {
    setStatus("loading");
    fetch("/api/commodities")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CommoditiesData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000); // 5-min refresh
    return () => clearInterval(interval);
  }, []);

  const items = data?.items || [];

  const filteredItems = useMemo(() => {
    let list = items;

    if (activeCategory !== "ALL") {
      list = list.filter((i) => i.category.toUpperCase() === activeCategory.toUpperCase());
    }

    const q = searchQuery.trim().toUpperCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.ticker.toUpperCase().includes(q) ||
          i.name.toUpperCase().includes(q) ||
          i.category.toUpperCase().includes(q)
      );
    }

    if (sortBy === "movers") {
      return [...list].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
    }
    if (sortBy === "price") {
      return [...list].sort((a, b) => b.price - a.price);
    }

    return list;
  }, [items, activeCategory, searchQuery, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <section
      className="commodities-panel"
      aria-label="Bloomberg Global Commodities Benchmark Matrix"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="COMM // COMMODITIES & ENERGY BENCHMARKS"
        title={`COMMODITIES MATRIX (${filteredItems.length})`}
        subtitle="FRED BENCHMARKS"
        sources="FRED COMMODITY SERIES"
        status={status}
        simulated={Boolean((data as any)?.simulated)}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">SECTOR:</span>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            return (
              <button
                key={cat}
                type="button"
                className={activeCategory === cat ? "active" : ""}
                onClick={() => setActiveCategory(cat)}
              >
                {cat.toUpperCase()} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">

        {/* Search & Sort Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <input
            type="text"
            className="fx-search-input"
            style={{ width: 140 }}
            aria-label="Search commodities"
            placeholder="SEARCH (e.g. GOLD, WTI)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="fx-search-clear"
              onClick={() => setSearchQuery("")}
            >
              CLEAR
            </button>
          )}

          <button
            type="button"
            className={`fx-pill${sortBy === "movers" ? " fx-pill-active" : ""}`}
            onClick={() => setSortBy(sortBy === "movers" ? "default" : "movers")}
            title="Sort by largest absolute % change"
          >
            MOVERS
          </button>

          <button type="button" className="fx-search-clear" onClick={loadData}>
            ↻ REFRESH
          </button>
        </div>

      {status === "loading" && !data && (
        <div className="panel-loading" style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
          LOADING COMMODITY BENCHMARKS...
        </div>
      )}

      {status === "error" && !data && (
        <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
          FAILED TO LOAD COMMODITIES DATA.
        </div>
      )}

      {filteredItems.length === 0 && data && (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          NO COMMODITIES MATCHING &ldquo;{searchQuery || activeCategory}&rdquo;
        </div>
      )}

      {filteredItems.length > 0 && (
        <div style={{ padding: "12px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "8px",
            }}
          >
            {filteredItems.map((c) => {
              const isUp = c.change >= 0;
              const formattedPrice =
                c.price >= 1000
                  ? `$${c.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : `$${c.price.toFixed(2)}`;

              return (
                <div
                  key={c.ticker}
                  style={{
                    background: "#0c0d0f",
                    border: "1px solid var(--border)",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    cursor: onSelectCommodity ? "pointer" : "default",
                    transition: "border-color 0.15s ease",
                  }}
                  onClick={() => onSelectCommodity?.(c.ticker)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "13px" }}>
                          {c.ticker}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            padding: "1px 4px",
                            background: "#16181b",
                            border: "1px solid #23272d",
                            color: "var(--muted)",
                          }}
                        >
                          {c.category}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text)", marginTop: "2px", fontWeight: 500 }}>
                        {c.name}
                      </div>
                    </div>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>
                      {c.unit}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "4px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                        {formattedPrice}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: isUp ? "var(--bid)" : "var(--ask)" }}>
                          {isUp ? "+" : ""}{c.change.toFixed(2)}
                        </span>
                        <span
                          style={{
                            color: isUp ? "var(--bid)" : "var(--ask)",
                            background: isUp ? "rgba(0, 200, 115, 0.1)" : "rgba(255, 68, 68, 0.1)",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            fontWeight: 600,
                          }}
                        >
                          {isUp ? "▲ +" : "▼ "}{c.changePercent.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                      {renderSparkline(c.sparkline, isUp)}
                      <span style={{ fontSize: "9px", color: "var(--muted)" }}>
                        OBS: {c.date}
                      </span>
                    </div>
                  </div>
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
