"use client";

import { useEffect, useState, type RefObject } from "react";
import type { DividendData } from "@/types/terminal";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "MSFT", "JNJ", "PG", "KO", "XOM", "JPM", "NVDA"] as const;

export default function DividendPanel({
  initialTicker = "AAPL",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker);
  const [inputVal, setInputVal] = useState(initialTicker);
  const [data, setData] = useState<DividendData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  useEffect(() => {
    setTicker(initialTicker);
    setInputVal(initialTicker);
  }, [initialTicker]);

  const loadData = (sym: string) => {
    setStatus("loading");
    fetchJsonWithRetry<DividendData>(`/api/dividends?ticker=${encodeURIComponent(sym)}`, undefined, {
      context: `PANEL:DVD:${sym}`,
      retries: 3,
      initialDelayMs: 500,
    })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    loadData(ticker);
  }, [ticker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputVal.trim().toUpperCase();
    if (clean && clean !== ticker) {
      setTicker(clean);
    }
  };

  return (
    <section
      className="dividend-panel"
      aria-label="Bloomberg Dividend Intelligence & Corporate Actions"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="DVD // DIVIDEND INTELLIGENCE & CORPORATE ACTIONS"
        title={`DIVIDEND PROFILE: ${ticker}`}
        subtitle={`${data?.frequency?.toUpperCase() || "QUARTERLY"} DISTRIBUTIONS`}
        sources="SEC & FINNHUB CORPORATE ACTIONS"
        status={status}
        tickers={QUICK_TICKERS as unknown as string[]}
        selectedTicker={ticker}
        onSelectTicker={(t) => {
          setTicker(t);
          setInputVal(t);
        }}
        inputTicker={inputVal}
        onInputTickerChange={setInputVal}
        onTickerSubmit={handleSubmit}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            FETCHING DIVIDEND CALENDAR &amp; SPLIT HISTORY FOR {ticker}...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD DIVIDEND METRICS FOR {ticker}.
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Key Metrics Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "8px",
            }}
          >
            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>INDICATED YIELD</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                {data.indicatedYield.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Trailing: {data.trailingYield.toFixed(2)}%
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>ANNUAL DIVIDEND</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                ${data.annualRate.toFixed(2)}
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Per Share / Year
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>PAYOUT RATIO</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--accent)", marginTop: "2px" }}>
                {data.payoutRatio.toFixed(1)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Of Net Income
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>5-YEAR CAGR</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                +{data.fiveYearCagr.toFixed(1)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Annualized Growth
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>DIVIDEND STREAK</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                {data.consecutiveYears} YRS
              </div>
              <div style={{ fontSize: "9px", color: "var(--accent)", marginTop: "2px" }}>
                {data.consecutiveYears >= 50
                  ? "DIVIDEND KING"
                  : data.consecutiveYears >= 25
                  ? "ARISTOCRAT"
                  : "CONTENDER"}
              </div>
            </div>
          </div>

          {/* Splits Banner if available */}
          {data.splits && data.splits.length > 0 && (
            <div
              style={{
                background: "rgba(255, 180, 0, 0.05)",
                border: "1px solid rgba(255, 180, 0, 0.2)",
                padding: "6px 10px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "11px",
              }}
            >
              <span style={{ color: "var(--accent)", fontWeight: "bold", fontSize: "10px" }}>
                HISTORICAL SPLITS:
              </span>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {data.splits.map((s, idx) => (
                  <span key={idx} style={{ color: "var(--text)" }}>
                    <strong>{s.ratio}</strong> on {s.date}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Historical Payments Table */}
          <div className="edgar-table-wrap">
            <table className="edgar-table">
              <thead>
                <tr>
                  <th style={{ width: "110px" }}>EX-DATE</th>
                  <th style={{ width: "110px" }}>CASH AMOUNT</th>
                  <th style={{ width: "110px" }}>RECORD DATE</th>
                  <th style={{ width: "110px" }}>PAY DATE</th>
                  <th style={{ width: "90px" }}>FREQUENCY</th>
                  <th style={{ textAlign: "right" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h, idx) => (
                  <tr key={`${h.exDate}-${idx}`} className="edgar-row">
                    <td className="edgar-date-col" style={{ fontWeight: 700, color: "var(--text)" }}>
                      {h.exDate}
                    </td>
                    <td style={{ color: "var(--bid)", fontWeight: 700 }}>
                      ${h.amount.toFixed(4)}
                    </td>
                    <td className="edgar-date-col">{h.recordDate}</td>
                    <td className="edgar-date-col">{h.payDate}</td>
                    <td>
                      <span
                        style={{
                          fontSize: "9px",
                          padding: "1px 5px",
                          background: "#16181b",
                          border: "1px solid #23272d",
                          color: "var(--muted)",
                        }}
                      >
                        {data.frequency}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--bid)",
                          background: "rgba(0, 200, 115, 0.1)",
                          padding: "1px 6px",
                          borderRadius: "2px",
                        }}
                      >
                        PAID
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

