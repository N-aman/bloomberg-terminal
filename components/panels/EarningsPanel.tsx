"use client";

import { useEffect, useState, type RefObject } from "react";
import type { EarningsData } from "@/app/api/earnings/route";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "AMD"];

export default function EarningsPanel({
  initialTicker = "NVDA",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [data, setData] = useState<EarningsData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (initialTicker) setTicker(initialTicker.toUpperCase());
  }, [initialTicker]);

  useEffect(() => {
    setStatus("loading");
    fetchJsonWithRetry<EarningsData>(`/api/earnings?ticker=${ticker}`, undefined, {
      context: `PANEL:EARNINGS:${ticker}`,
      retries: 3,
      initialDelayMs: 500,
    })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, [ticker]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setTicker(clean);
      setSearchInput("");
    }
  };

  return (
    <section
      className="earnings-panel"
      aria-label="Bloomberg Corporate Earnings and Surprises"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="EARN // QUARTERLY EARNINGS SURPRISES"
        title={`${ticker} EARNINGS`}
        subtitle="BEAT/MISS TRACK RECORD"
        sources="FINNHUB + SEC 8-K"
        status={status}
        simulated={Boolean(data?.simulated)}
        tickers={QUICK_TICKERS}
        selectedTicker={ticker}
        onSelectTicker={(t) => setTicker(t)}
        inputTicker={searchInput}
        onInputTickerChange={setSearchInput}
        onTickerSubmit={handleSearch}
      />

      <div className="panel-content-body">
        {status === "loading" && (
          <div className="panel-loading" style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            LOADING {ticker} EARNINGS SURPRISES...
          </div>
        )}

        {status === "error" && (
          <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD EARNINGS DATA FOR {ticker}. PLEASE VERIFY SYMBOL.
          </div>
        )}

        {data && status !== "loading" && (
          <div>
            {/* Header Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginBottom: "12px" }}>
              <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
                <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>BEAT STREAK</div>
                <div style={{ color: "var(--bid)", fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>
                  {data.beatStreak} CONSECUTIVE QUARTERS
                </div>
                <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                  HISTORICAL TRACK RECORD
                </div>
              </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>NEXT EXPECTED REPORT</div>
              <div style={{ color: "var(--accent)", fontSize: "14px", fontWeight: "bold", marginTop: "2px" }}>
                {data.nextEarningsDate}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                ESTIMATED RELEASE
              </div>
            </div>
          </div>

          {/* Quarterly Report Table */}
          <div style={{ background: "#0d0e10", border: "1px solid var(--border)" }}>
            <div style={{ background: "#111214", padding: "6px 12px", borderBottom: "1px solid var(--border)", color: "var(--accent)", fontWeight: "bold", fontSize: "10px", letterSpacing: "0.08em" }}>
              HISTORICAL QUARTERLY EPS SURPRISES (ACTUAL VS ESTIMATE)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "right" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700 }}>QUARTER</th>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700 }}>PERIOD END</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>ESTIMATE EPS</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>ACTUAL EPS</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>SURPRISE ($)</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>SURPRISE (%)</th>
                  <th style={{ padding: "6px 12px", textAlign: "center", fontWeight: 700 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.reports.map((rep, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #1a1d21" }}>
                    <td style={{ padding: "6px 12px", textAlign: "left", color: "var(--text)", fontWeight: 500 }}>{rep.quarter}</td>
                    <td style={{ padding: "6px 12px", textAlign: "left", color: "var(--muted)" }}>{rep.period}</td>
                    <td style={{ padding: "6px 12px", color: "var(--muted)" }}>
                      {rep.estimate != null ? `$${rep.estimate.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "6px 12px", color: "var(--text)", fontWeight: "bold" }}>
                      {rep.actual != null ? `$${rep.actual.toFixed(2)}` : "—"}
                    </td>
                    <td style={{ padding: "6px 12px", color: (rep.surprise ?? 0) >= 0 ? "var(--bid)" : "var(--ask)" }}>
                      {rep.surprise != null
                        ? rep.surprise >= 0
                          ? `+$${rep.surprise.toFixed(2)}`
                          : `-$${Math.abs(rep.surprise).toFixed(2)}`
                        : "—"}
                    </td>
                    <td style={{ padding: "6px 12px", color: (rep.surprisePercent ?? 0) >= 0 ? "var(--bid)" : "var(--ask)", fontWeight: "bold" }}>
                      {rep.surprisePercent != null
                        ? rep.surprisePercent >= 0
                          ? `+${rep.surprisePercent}%`
                          : `${rep.surprisePercent}%`
                        : "—"}
                    </td>
                    <td style={{ padding: "6px 12px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "1px 5px",
                          fontSize: "9px",
                          fontWeight: "bold",
                          borderRadius: "2px",
                          background: rep.beat ? "#3ecf6e20" : "#e0535320",
                          color: rep.beat ? "var(--bid)" : "var(--ask)",
                          border: `1px solid ${rep.beat ? "var(--bid)" : "var(--ask)"}`,
                        }}
                      >
                        {rep.beat ? "BEAT" : "MISS"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </section>
);
}
