"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CompanyDossier } from "@/app/api/dossier/route";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL"];

function fmtCap(val: number): string {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}T`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}B`;
  return `$${val.toFixed(0)}M`;
}

export default function CompanyDossierPanel({
  initialTicker = "AAPL",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [data, setData] = useState<CompanyDossier | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (initialTicker) setTicker(initialTicker.toUpperCase());
  }, [initialTicker]);

  useEffect(() => {
    setStatus("loading");
    fetchJsonWithRetry<CompanyDossier>(`/api/dossier?ticker=${ticker}`, undefined, {
      context: `PANEL:DOSSIER:${ticker}`,
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
      className="dossier-panel"
      aria-label="Bloomberg Company Description Dossier"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="DES // COMPANY DESCRIPTION & DOSSIER"
        title={`${ticker} DOSSIER`}
        subtitle={data?.name}
        sources="SEC EDGAR + FINNHUB"
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
            LOADING {ticker} COMPANY DOSSIER...
          </div>
        )}

        {status === "error" && (
          <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD DOSSIER FOR {ticker}. PLEASE VERIFY SYMBOL.
          </div>
        )}

        {data && status !== "loading" && (
          <div>
          {/* Header Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginBottom: "12px" }}>
            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>ISSUER NAME</div>
              <div style={{ color: "var(--accent)", fontSize: "14px", fontWeight: "bold", marginTop: "2px" }}>{data.name}</div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>{data.exchange} • {data.country}</div>
            </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>MARKET CAPITALIZATION</div>
              <div style={{ color: "var(--bid)", fontSize: "14px", fontWeight: "bold", marginTop: "2px" }}>{fmtCap(data.marketCap)}</div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>SHARES: {data.shareOutstanding?.toLocaleString()}M</div>
            </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>INDUSTRY &amp; SECTOR</div>
              <div style={{ color: "var(--text)", fontSize: "13px", fontWeight: "bold", marginTop: "2px" }}>{data.industry}</div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>IPO: {data.ipo}</div>
            </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>VALUATION &amp; BETA</div>
              <div style={{ color: "var(--accent)", fontSize: "13px", fontWeight: "bold", marginTop: "2px" }}>
                P/E: {data.keyStats.peRatio ?? "N/A"} • BETA: {data.keyStats.beta ?? "1.0"}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>DIV YIELD: {data.keyStats.dividendYield}%</div>
            </div>
          </div>

          {/* Business Summary Description */}
          <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px 12px", marginBottom: "12px", lineHeight: "1.45" }}>
            <div style={{ color: "var(--accent)", fontSize: "10px", fontWeight: "bold", marginBottom: "4px", letterSpacing: "0.08em" }}>
              BUSINESS OVERVIEW:
            </div>
            <p style={{ margin: 0, color: "var(--text)", fontSize: "11px" }}>
              {data.description}
            </p>
            {data.weburl && (
              <div style={{ marginTop: "6px", fontSize: "10px" }}>
                <span style={{ color: "var(--muted)" }}>OFFICIAL WEB: </span>
                <a href={data.weburl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  {data.weburl}
                </a>
              </div>
            )}
          </div>

          {/* Key Executive Leadership */}
          <div style={{ background: "#0d0e10", border: "1px solid var(--border)" }}>
            <div style={{ background: "#111214", padding: "6px 12px", borderBottom: "1px solid var(--border)", color: "var(--accent)", fontWeight: "bold", fontSize: "10px", letterSpacing: "0.08em" }}>
              EXECUTIVE MANAGEMENT (SEC REPORTED OFFICERS)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>OFFICER NAME</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>CORPORATE TITLE</th>
                </tr>
              </thead>
              <tbody>
                {data.executives.map((exec, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #1a1d21" }}>
                    <td style={{ padding: "6px 12px", color: "var(--text)", fontWeight: 500 }}>{exec.name}</td>
                    <td style={{ padding: "6px 12px", color: "var(--muted)" }}>{exec.title}</td>
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
