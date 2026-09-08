"use client";

import { useEffect, useState, type RefObject } from "react";
import type { RelativeValuationData, PeerMetric } from "@/types/terminal";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "JPM", "XOM", "PLTR"] as const;

export default function RelativeValuationPanel({
  initialTicker = "AAPL",
  panelRef,
  onSelectPeer,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
  onSelectPeer?: (ticker: string) => void;
}) {
  const [ticker, setTicker] = useState(initialTicker);
  const [inputVal, setInputVal] = useState(initialTicker);
  const [data, setData] = useState<RelativeValuationData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  useEffect(() => {
    setTicker(initialTicker);
    setInputVal(initialTicker);
  }, [initialTicker]);

  const loadData = (sym: string) => {
    setStatus("loading");
    fetchJsonWithRetry<RelativeValuationData>(`/api/peers?ticker=${encodeURIComponent(sym)}`, undefined, {
      context: `PANEL:RV:${sym}`,
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
      className="valuation-panel"
      aria-label="Bloomberg Relative Valuation & Peer Comps"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="RV // RELATIVE VALUATION & PEER COMPS"
        title={`PEER COMPS: ${ticker}`}
        subtitle={data?.industry?.toUpperCase() || "PEER BENCHMARKS"}
        sources={data?.valuationAssessment ? `VALUATION: ${data.valuationAssessment}` : "PEER MULTIPLES"}
        status={status}
        tickers={QUICK_TICKERS as unknown as string[]}
        selectedTicker={ticker}
        inputTicker={inputVal}
        onInputTickerChange={setInputVal}
        onTickerSubmit={handleSubmit}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            COMPILING PEER VALUATION MATRIX FOR {ticker}...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD PEER VALUATIONS FOR {ticker}.
          </div>
        )}

        {data && (
          <div>
            <div className="edgar-table-wrap">
              <table className="edgar-table">
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>COMPANY / TICKER</th>
                    <th style={{ textAlign: "right", width: "80px" }}>PRICE</th>
                    <th style={{ textAlign: "right", width: "90px" }}>MKT CAP ($B)</th>
                    <th style={{ textAlign: "right", width: "80px" }}>P/E (TTM)</th>
                    <th style={{ textAlign: "right", width: "80px" }}>FWD P/E</th>
                    <th style={{ textAlign: "right", width: "80px" }}>EV/EBITDA</th>
                    <th style={{ textAlign: "right", width: "70px" }}>P/S</th>
                    <th style={{ textAlign: "right", width: "85px" }}>GROSS MARG</th>
                    <th style={{ textAlign: "right", width: "85px" }}>OP MARGIN</th>
                    <th style={{ textAlign: "right", width: "80px" }}>REV YOY</th>
                    <th style={{ textAlign: "right", width: "75px" }}>ROE</th>
                  </tr>
                </thead>
              <tbody>
                {data.peers.map((p) => {
                  const isTarget = p.isTarget;
                  return (
                    <tr
                      key={p.ticker}
                      className="edgar-row"
                      style={{
                        background: isTarget ? "rgba(255, 180, 0, 0.08)" : undefined,
                        borderLeft: isTarget ? "3px solid var(--accent)" : undefined,
                        cursor: onSelectPeer && !isTarget ? "pointer" : "default",
                      }}
                      onClick={() => !isTarget && onSelectPeer?.(p.ticker)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 700, color: isTarget ? "var(--accent)" : "var(--text)" }}>
                            {p.ticker}
                          </span>
                          {isTarget && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "var(--accent)",
                                color: "#000",
                                padding: "0 4px",
                                fontWeight: 700,
                                borderRadius: "2px",
                              }}
                            >
                              TARGET
                            </span>
                          )}
                          <span style={{ fontSize: "10px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        ${p.price.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        ${p.marketCapB.toLocaleString()}B
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: isTarget ? 700 : 400 }}>
                        {p.peRatio.toFixed(1)}x
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.forwardPe.toFixed(1)}x
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.evEbitda.toFixed(1)}x
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.priceToSales.toFixed(1)}x
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: p.grossMarginPercent > 50 ? "var(--bid)" : "var(--text)" }}>
                        {p.grossMarginPercent.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.operatingMarginPercent.toFixed(1)}%
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: p.revenueGrowthYoy >= 0 ? "var(--bid)" : "var(--ask)",
                          fontWeight: 600,
                        }}
                      >
                        {p.revenueGrowthYoy >= 0 ? "+" : ""}{p.revenueGrowthYoy.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {p.roePercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}

                {/* Industry Benchmark Rows */}
                {data.median && (
                  <tr
                    className="edgar-row"
                    style={{
                      background: "#111418",
                      borderTop: "2px solid var(--border)",
                      fontWeight: 600,
                    }}
                  >
                    <td>
                      <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                        ★ INDUSTRY MEDIAN
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      ${data.median.price.toFixed(2)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      ${data.median.marketCapB.toLocaleString()}B
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
                      {data.median.peRatio.toFixed(1)}x
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.forwardPe.toFixed(1)}x
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.evEbitda.toFixed(1)}x
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.priceToSales.toFixed(1)}x
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.grossMarginPercent.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.operatingMarginPercent.toFixed(1)}%
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: data.median.revenueGrowthYoy >= 0 ? "var(--bid)" : "var(--ask)",
                      }}
                    >
                      {data.median.revenueGrowthYoy >= 0 ? "+" : ""}{data.median.revenueGrowthYoy.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {data.median.roePercent.toFixed(1)}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </section>
);
}

