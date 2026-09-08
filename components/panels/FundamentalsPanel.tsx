"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CompanyFundamentals, FinancialPeriod } from "@/lib/providers/fundamentals";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL"];

function fmtCurrency(val: number): string {
  if (Math.abs(val) >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
}

export default function FundamentalsPanel({
  initialTicker = "AAPL",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [data, setData] = useState<CompanyFundamentals | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (initialTicker) setTicker(initialTicker.toUpperCase());
  }, [initialTicker]);

  useEffect(() => {
    setStatus("loading");
    fetchJsonWithRetry<CompanyFundamentals>(`/api/fundamentals?ticker=${ticker}`, undefined, {
      context: `PANEL:FA:${ticker}`,
      retries: 3,
      initialDelayMs: 500,
    })
      .then((d) => {
        setData(d);
        if (d.unavailable) {
          setStatus("error");
        } else {
          setStatus(d.stale ? "stale" : "live");
        }
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

  const periods = data?.periods ?? [];
  const years = periods.map((p) =>
    p.period === "TTM" ? `FY${p.fiscalYear} TTM` : `FY${p.fiscalYear}`
  );

  return (
    <section
      className="fundamentals-panel"
      aria-label="SEC Financial Analysis and Fundamentals"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="FA // FINANCIAL ANALYSIS & STATEMENTS"
        title={`${ticker} FUNDAMENTALS`}
        subtitle={data?.name}
        sources="SEC EDGAR 10-K & 10-Q"
        status={status}
        tickers={QUICK_TICKERS}
        selectedTicker={ticker}
        onSelectTicker={(t) => setTicker(t)}
        inputTicker={searchInput}
        onInputTickerChange={setSearchInput}
        onTickerSubmit={handleSearch}
      />

      <div className="panel-content-body">

        {/* Company Valuation Metadata Strip — only when real data exists */}
        {data && !data.unavailable && (
          <div className="edgar-meta-strip">
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">MARKET CAP</span>
              <span className="edgar-meta-val">{fmtCurrency(data.marketCap)}</span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">P/E RATIO (TTM)</span>
              <span className="edgar-meta-val" style={{ color: "var(--accent)" }}>{data.peRatio.toFixed(1)}x</span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">CIK CODE</span>
              <span className="edgar-meta-val">{data.cik}</span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">CURRENCY</span>
              <span className="edgar-meta-val">{data.currency}</span>
            </div>
          </div>
        )}

        {/* Financial Statements Matrix Table */}
        {status === "loading" && !data ? (
          <p className="news-empty">Extracting financial statement metrics from SEC EDGAR…</p>
        ) : data?.unavailable ? (
          <div className="hds-unknown-banner">
            <span className="hds-unknown-icon">⚠</span>
            <span>
              FINANCIAL DATA UNAVAILABLE: NO VERIFIED STATEMENTS FOUND FOR{" "}
              <strong>{ticker}</strong>.
              <br />
              <span style={{ opacity: 0.65, fontSize: "0.88em" }}>
                Only tickers in the institutional registry have FA data.
                Add {ticker} to the registry in{" "}
                <code>lib/providers/fundamentals.ts</code> to display statements.
              </span>
            </span>
          </div>
        ) : periods.length === 0 ? (
          <p className="news-empty">No fundamental statement data available for {ticker}.</p>
        ) : (
          <div className="fa-table-wrap">
            <table className="fa-matrix-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>FINANCIAL METRIC (USD)</th>
                  {years.map((y) => (
                    <th key={y} style={{ textAlign: "right", width: "120px" }}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* INCOME STATEMENT */}
                <tr className="fa-section-row">
                  <td colSpan={years.length + 1}>INCOME STATEMENT</td>
                </tr>
                <tr>
                  <td className="fa-metric-name">Total Revenue</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--text)", fontWeight: 700 }}>
                      {fmtCurrency(p.revenue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name" style={{ paddingLeft: "16px", color: "var(--muted)" }}>Cost of Goods Sold</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--muted)" }}>
                      {fmtCurrency(p.costOfRevenue)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Gross Profit</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--bid)" }}>
                      {fmtCurrency(p.grossProfit)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Operating Income (EBIT)</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val">
                      {fmtCurrency(p.operatingIncome)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name" style={{ fontWeight: 700, color: "var(--accent)" }}>Net Income</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {fmtCurrency(p.netIncome)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Diluted EPS</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val">
                      ${p.eps.toFixed(2)}
                    </td>
                  ))}
                </tr>

                {/* MARGINS & RATIOS */}
                <tr className="fa-section-row">
                  <td colSpan={years.length + 1}>MARGINS &amp; PROFITABILITY</td>
                </tr>
                <tr>
                  <td className="fa-metric-name">Gross Margin</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--bid)" }}>
                      {p.grossMarginPct.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Operating Margin</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val">
                      {p.operatingMarginPct.toFixed(1)}%
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Net Profit Margin</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--accent)" }}>
                      {p.netMarginPct.toFixed(1)}%
                    </td>
                  ))}
                </tr>

                {/* BALANCE SHEET & CASH FLOW */}
                <tr className="fa-section-row">
                  <td colSpan={years.length + 1}>BALANCE SHEET &amp; CASH FLOW</td>
                </tr>
                <tr>
                  <td className="fa-metric-name">Cash &amp; Equivalents</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val">
                      {fmtCurrency(p.cashAndEquivalents)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Total Debt</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ color: "var(--ask)" }}>
                      {fmtCurrency(p.totalDebt)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name">Operating Cash Flow</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val">
                      {fmtCurrency(p.operatingCashFlow)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="fa-metric-name" style={{ fontWeight: 700, color: "var(--bid)" }}>Free Cash Flow</td>
                  {periods.map((p) => (
                    <td key={p.fiscalYear} className="fa-metric-val" style={{ fontWeight: 700, color: "var(--bid)" }}>
                      {fmtCurrency(p.freeCashFlow)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

