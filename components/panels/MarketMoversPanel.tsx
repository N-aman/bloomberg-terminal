"use client";

import { useEffect, useState, type RefObject } from "react";
import type { MarketMoversData, MarketMoverItem } from "@/app/api/movers/route";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

function fmtVol(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

export default function MarketMoversPanel({
  panelRef,
  onSelectSymbol,
}: {
  panelRef?: RefObject<HTMLElement | null>;
  onSelectSymbol?: (symbol: string, category: "EQUITY" | "CRYPTO") => void;
}) {
  const [data, setData] = useState<MarketMoversData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [tab, setTab] = useState<"gainers" | "losers" | "mostActive">("gainers");

  const loadData = () => {
    setStatus((prev) => (data ? prev : "loading"));
    fetchJsonWithRetry<MarketMoversData>("/api/movers", undefined, {
      context: "PANEL:MOVERS",
      retries: 2,
      initialDelayMs: 400,
    })
      .then((d) => {
        if (!d || !Array.isArray(d.gainers) || !Array.isArray(d.losers)) {
          throw new Error("Invalid market movers payload");
        }
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => {
        setStatus("error");
      });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000); // 1-minute polling
    return () => clearInterval(interval);
  }, []);

  const items: MarketMoverItem[] = (data && Array.isArray(data[tab])) ? data[tab] : [];

  return (
    <section
      className="movers-panel"
      aria-label="Bloomberg Market Movers and Volume Leaders"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="MOST // MARKET MOVERS & VOLUME LEADERS"
        title="CROSS-ASSET MOVERS"
        subtitle="EQUITIES & CRYPTOS"
        sources="BINANCE + US EQUITIES"
        status={status}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span className="picker-label">VIEW:</span>
          <button
            type="button"
            className={tab === "gainers" ? "active" : ""}
            onClick={() => setTab("gainers")}
          >
            ▲ GAINERS
          </button>
          <button
            type="button"
            className={tab === "losers" ? "active" : ""}
            onClick={() => setTab("losers")}
          >
            ▼ LOSERS
          </button>
          <button
            type="button"
            className={tab === "mostActive" ? "active" : ""}
            onClick={() => setTab("mostActive")}
          >
            ● ACTIVE
          </button>
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div className="panel-loading" style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            CALCULATING GLOBAL MARKET MOVERS...
          </div>
        )}

        {status === "error" && (!data || items.length === 0) && (
          <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px", textAlign: "center" }}>
            MARKET MOVERS DATA CURRENTLY UNAVAILABLE.
          </div>
        )}

        {data && items.length > 0 && (
          <div>
            <div style={{ background: "#0d0e10", border: "1px solid var(--border)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "right" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700 }}>#</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700 }}>TICKER</th>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700 }}>SECURITY NAME</th>
                  <th style={{ padding: "6px 10px", textAlign: "center", fontWeight: 700 }}>ASSET</th>
                  <th style={{ padding: "6px 10px", fontWeight: 700 }}>LAST PRICE</th>
                  <th style={{ padding: "6px 10px", fontWeight: 700 }}>24H CHANGE</th>
                  <th style={{ padding: "6px 10px", fontWeight: 700 }}>% CHG</th>
                  <th style={{ padding: "6px 10px", fontWeight: 700 }}>24H TURNOVER / VOL</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr
                    key={`${item.category}-${item.symbol}-${idx}`}
                    style={{
                      borderBottom: "1px solid #1a1d21",
                      cursor: "pointer",
                      transition: "background 0.12s",
                    }}
                    onClick={() => onSelectSymbol?.(item.symbol, item.category)}
                    className="hover:bg-white/5"
                  >
                    <td style={{ padding: "6px 10px", textAlign: "left", color: "var(--muted)" }}>{idx + 1}</td>
                    <td style={{ padding: "6px 10px", textAlign: "left", color: "var(--accent)", fontWeight: "bold" }}>
                      {item.symbol}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "left", color: "var(--text)" }}>
                      {item.name}
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: "bold",
                          padding: "1px 4px",
                          borderRadius: "2px",
                          background: item.category === "CRYPTO" ? "#e0a83515" : "#3ecf6e15",
                          color: item.category === "CRYPTO" ? "var(--accent)" : "var(--bid)",
                          border: `1px solid ${item.category === "CRYPTO" ? "var(--accent)" : "var(--bid)"}`,
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--text)", fontWeight: "500" }}>
                      ${item.price >= 10 ? item.price.toFixed(2) : item.price.toFixed(4)}
                    </td>
                    <td style={{ padding: "6px 10px", color: item.change >= 0 ? "var(--bid)" : "var(--ask)" }}>
                      {item.change >= 0 ? `+$${item.change.toFixed(2)}` : `-$${Math.abs(item.change).toFixed(2)}`}
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        color: item.changePercent >= 0 ? "var(--bid)" : "var(--ask)",
                        fontWeight: "bold",
                      }}
                    >
                      {item.changePercent >= 0 ? `+${item.changePercent.toFixed(2)}%` : `${item.changePercent.toFixed(2)}%`}
                    </td>
                    <td style={{ padding: "6px 10px", color: "var(--muted)" }}>
                      {fmtVol(item.volume)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--muted)" }}>
            Tip: Click any security row to route directly to its technical chart and order book.
          </div>
        </div>
      )}
    </div>
  </section>
);
}
