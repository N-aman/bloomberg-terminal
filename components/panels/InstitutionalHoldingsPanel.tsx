"use client";

import { useEffect, useState, type RefObject } from "react";
import type { HoldersData } from "@/types/terminal";
import { fetchWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "JPM"] as const;

export default function InstitutionalHoldingsPanel({
  initialTicker = "AAPL",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker);
  const [inputVal, setInputVal] = useState(initialTicker);
  const [data, setData] = useState<HoldersData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  useEffect(() => {
    setTicker(initialTicker);
    setInputVal(initialTicker);
  }, [initialTicker]);

  const loadData = (sym: string) => {
    setStatus("loading");
    setErrorMessage(null);
    // 404 for unknown tickers is intentional (no filings found) — do NOT retry 404
    // Only retry transient server errors (5xx) and timeouts
    fetchWithRetry(`/api/holders?ticker=${encodeURIComponent(sym)}`, undefined, {
      context: `PANEL:HDS:${sym}`,
      retries: 2,
      initialDelayMs: 600,
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${r.status}`);
        }
        return r.json() as Promise<HoldersData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch((err) => {
        setData(null);
        setErrorMessage(err.message || `No filings found for ${sym}`);
        setStatus("error");
      });
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
      className="holders-panel"
      aria-label="Bloomberg Institutional Holders & Insider Ownership"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="HDS // INSTITUTIONAL HOLDERS & INSIDER OWNERSHIP"
        title={`SHAREHOLDER MATRIX: ${ticker}`}
        subtitle={`${data?.companyName || ""} · 13F & FORM 4`}
        sources="SEC EDGAR 13F-HR & FORM 4"
        status={status}
        simulated={Boolean(data?.simulated)}
        tickers={QUICK_TICKERS as unknown as string[]}
        selectedTicker={ticker}
        onSelectTicker={(t) => {
          setTicker(t);
          setInputVal(t);
        }}
        inputTicker={inputVal}
        onInputTickerChange={setInputVal}
        onTickerSubmit={handleSubmit}
        onRefresh={() => loadData(ticker)}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            COMPILING 13F-HR &amp; FORM 4 HOLDINGS FOR {ticker}...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "20px 16px", background: "rgba(255, 68, 68, 0.05)", borderBottom: "1px solid rgba(255, 68, 68, 0.2)" }}>
            <div style={{ color: "var(--color-red)", fontWeight: "bold", fontSize: "12px", letterSpacing: "0.5px" }}>
              ⚠ {errorMessage || `UNKNOWN SECURITY: NO 13F OR FORM 4 FILINGS FOUND FOR ${ticker}.`}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>
              Please select a verified reporting issuer from the QUICK pills or enter a valid US equity (e.g. AAPL, NVDA, MSFT, TSLA, AMZN, GOOGL, JPM).
            </div>
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Key Stat Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "8px",
              }}
            >
              <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
                <div style={{ fontSize: "9px", color: "var(--muted)" }}>INSTITUTIONAL OWNERSHIP</div>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                  {data.institutionalOwnershipPercent.toFixed(1)}%
                </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                {data.totalInstitutions.toLocaleString()} Active Funds
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>TOP 10 CONCENTRATION</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--accent)", marginTop: "2px" }}>
                {data.top10ConcentrationPercent.toFixed(1)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Held by Top 10 Institutions
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>INSIDER OWNERSHIP</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                {data.insiderOwnershipPercent.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Officers &amp; Directors
              </div>
            </div>
          </div>

          {/* Top Institutional Holders Table */}
          <div>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", marginBottom: "6px" }}>
              TOP 10 INSTITUTIONAL SHAREHOLDERS (13F FILINGS)
            </div>
            <div className="edgar-table-wrap">
              <table className="edgar-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>INSTITUTIONAL HOLDER</th>
                    <th style={{ textAlign: "right", width: "110px" }}>SHARES HELD</th>
                    <th style={{ textAlign: "right", width: "90px" }}>VALUE ($B)</th>
                    <th style={{ textAlign: "right", width: "80px" }}>% OUT</th>
                    <th style={{ textAlign: "right", width: "100px" }}>QoQ CHG</th>
                    <th style={{ textAlign: "right", width: "90px" }}>FILING DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holders.map((h) => {
                    const isPositive = h.changeQoQShares >= 0;
                    return (
                      <tr key={h.rank} className="edgar-row">
                        <td style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{h.rank}</td>
                        <td style={{ fontWeight: 600, color: "var(--text)" }}>{h.holderName}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {(h.sharesHeld / 1_000_000).toFixed(1)}M
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ${h.valueB.toFixed(1)}B
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                          {h.percentOut.toFixed(1)}%
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontFamily: "var(--font-mono)",
                            color: isPositive ? "var(--bid)" : "var(--ask)",
                          }}
                        >
                          {isPositive ? "+" : ""}{h.changePercent.toFixed(2)}%
                        </td>
                        <td className="edgar-date-col" style={{ textAlign: "right" }}>{h.filingDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Form 4 Insider Transactions */}
          {data.insiderTransactions && data.insiderTransactions.length > 0 && (
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>
                RECENT FORM 4 INSIDER TRANSACTIONS
              </div>
              <div className="edgar-table-wrap">
                <table className="edgar-table">
                  <thead>
                    <tr>
                      <th>INSIDER / EXECUTIVE</th>
                      <th>TITLE</th>
                      <th>TYPE</th>
                      <th style={{ textAlign: "right" }}>SHARES</th>
                      <th style={{ textAlign: "right" }}>PRICE</th>
                      <th style={{ textAlign: "right" }}>TOTAL VALUE</th>
                      <th style={{ textAlign: "right" }}>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.insiderTransactions.map((tx, idx) => (
                      <tr key={idx} className="edgar-row">
                        <td style={{ fontWeight: 700, color: "var(--accent)" }}>{tx.insiderName}</td>
                        <td style={{ color: "var(--muted)", fontSize: "10px" }}>{tx.title}</td>
                        <td>
                          <span
                            style={{
                              fontSize: "9px",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: "2px",
                              color: tx.transactionType === "SALE" ? "var(--ask)" : "var(--bid)",
                              background:
                                tx.transactionType === "SALE"
                                  ? "rgba(255, 68, 68, 0.1)"
                                  : "rgba(0, 200, 115, 0.1)",
                            }}
                          >
                            {tx.transactionType}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          {tx.shares.toLocaleString()}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ${tx.pricePerShare.toFixed(2)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                          ${(tx.totalValue / 1_000_000).toFixed(2)}M
                        </td>
                        <td className="edgar-date-col" style={{ textAlign: "right" }}>{tx.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </section>
);
}
