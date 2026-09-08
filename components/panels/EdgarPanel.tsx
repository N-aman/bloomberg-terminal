"use client";

import { useEffect, useState, useMemo, type RefObject } from "react";
import type { CompanyFilings, EdgarFiling } from "@/lib/providers/edgar";
import { TOP_CIK_MAP } from "@/lib/providers/edgar";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "GOOGL", "META", "AMD", "SPY"];
const FORM_FILTERS = [
  { id: "ALL", label: "ALL" },
  { id: "10-K", label: "10-K (ANNUAL)" },
  { id: "10-Q", label: "10-Q (QUARTERLY)" },
  { id: "8-K", label: "8-K (EVENTS)" },
  { id: "FORM 4", label: "FORM 4 (INSIDER)" },
  { id: "DEF 14A", label: "DEF 14A" },
];

function formBadgeClass(form: string): string {
  const f = form.toUpperCase();
  if (f === "10-K" || f === "10-K/A") return "edgar-badge-10k";
  if (f === "10-Q" || f === "10-Q/A") return "edgar-badge-10q";
  if (f === "8-K" || f === "8-K/A") return "edgar-badge-8k";
  if (f === "4" || f === "4/A" || f === "FORM 4" || f === "144" || f === "144/A") return "edgar-badge-form4";
  if (f.includes("14A")) return "edgar-badge-def14a";
  return "edgar-badge-other";
}

function fmtBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export default function EdgarPanel({
  initialTicker = "AAPL",
  initialForm = "ALL",
  panelRef,
}: {
  initialTicker?: string;
  initialForm?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [activeForm, setActiveForm] = useState(initialForm.toUpperCase());
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState<CompanyFilings | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  useEffect(() => {
    if (initialTicker) setTicker(initialTicker.toUpperCase());
  }, [initialTicker]);

  useEffect(() => {
    if (initialForm) setActiveForm(initialForm.toUpperCase());
  }, [initialForm]);

  // Fetch full recent company submissions whenever ticker changes
  useEffect(() => {
    setStatus("loading");
    fetch(`/api/edgar?ticker=${ticker}`)
      .then((r) => r.json() as Promise<CompanyFilings & { error?: string }>)
      .then((d) => {
        if ("error" in d && d.error) throw new Error(d.error);
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, [ticker]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setTicker(clean);
      setSearchInput("");
    }
  };

  // Instantaneous in-memory filtering over company filings
  const filteredFilings = useMemo(() => {
    if (!data?.filings) return [];
    if (activeForm === "ALL") return data.filings;

    return data.filings.filter((f) => {
      const formUpper = f.form.toUpperCase();
      if (activeForm === "FORM 4" || activeForm === "4" || activeForm === "INSIDER") {
        return formUpper === "4" || formUpper === "4/A" || formUpper === "FORM 4" || formUpper === "144" || formUpper === "144/A" || formUpper.startsWith("4");
      }
      if (activeForm === "10-K") return formUpper.startsWith("10-K");
      if (activeForm === "10-Q") return formUpper.startsWith("10-Q");
      if (activeForm === "8-K") return formUpper.startsWith("8-K");
      if (activeForm === "DEF 14A") return formUpper.includes("14A");
      return formUpper === activeForm || formUpper.startsWith(activeForm);
    });
  }, [data, activeForm]);

  return (
    <section
      className="edgar-panel"
      aria-label="SEC EDGAR Corporate Filings"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="SEC EDGAR // CORPORATE DISCLOSURES"
        title={`${ticker} FILINGS`}
        subtitle={data?.name}
        sources="SEC EDGAR REST API"
        status={status}
        tickers={QUICK_TICKERS}
        selectedTicker={ticker}
        onSelectTicker={(t) => setTicker(t)}
        inputTicker={searchInput}
        onInputTickerChange={setSearchInput}
        onTickerSubmit={handleSearchSubmit}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">FORM:</span>
          {FORM_FILTERS.map(({ id, label }) => {
            const isActive = activeForm === id || (id === "FORM 4" && activeForm === "4");
            return (
              <button
                key={id}
                type="button"
                className={isActive ? "active" : ""}
                onClick={() => setActiveForm(id)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">

        {/* Company Header Metadata Strip */}
        {data && (
          <div className="edgar-meta-strip">
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">CIK</span>
              <span className="edgar-meta-val">{data.cik}</span>
            </div>
            {data.sicDescription && (
              <div className="edgar-meta-item">
                <span className="edgar-meta-label">SECTOR / SIC</span>
                <span className="edgar-meta-val">{data.sicDescription}</span>
              </div>
            )}
            {data.fiscalYearEnd && (
              <div className="edgar-meta-item">
                <span className="edgar-meta-label">FY END</span>
                <span className="edgar-meta-val">{data.fiscalYearEnd}</span>
              </div>
            )}
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">TOTAL LOADED</span>
              <span className="edgar-meta-val">{filteredFilings.length} FILINGS</span>
            </div>
          </div>
        )}

        {/* Filings Table */}
        {status === "loading" && !data ? (
          <p className="news-empty">Fetching corporate filings from SEC.gov…</p>
        ) : status === "error" && !data ? (
          <p className="news-empty">SEC EDGAR filings currently unavailable for {ticker}.</p>
        ) : filteredFilings.length === 0 ? (
          <p className="news-empty">No {activeForm} disclosures found for {ticker}.</p>
        ) : (
          <div className="edgar-table-wrap">
            <table className="edgar-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>FORM</th>
                  <th style={{ width: "100px" }}>FILED</th>
                  <th style={{ width: "100px" }}>PERIOD</th>
                  <th>DESCRIPTION / TITLE</th>
                  <th style={{ width: "80px", textAlign: "right" }}>SIZE</th>
                  <th style={{ width: "80px", textAlign: "right" }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredFilings.map((filing) => (
                  <tr key={filing.accessionNumber} className="edgar-row">
                    <td>
                      <span className={`edgar-badge ${formBadgeClass(filing.form)}`}>
                        {filing.form}
                      </span>
                    </td>
                    <td className="edgar-date-col">{filing.filingDate}</td>
                    <td className="edgar-date-col">{filing.reportDate || "—"}</td>
                    <td className="edgar-desc-col" title={filing.description}>
                      <span className="edgar-desc-text">{filing.description}</span>
                      <span className="edgar-accession">ACC: {filing.accessionNumber}</span>
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)", fontSize: "10px" }}>
                      {fmtBytes(filing.size)}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <a
                        href={filing.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="edgar-view-link"
                        title="Open document on SEC.gov"
                      >
                        VIEW ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
