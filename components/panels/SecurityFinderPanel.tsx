"use client";

import { useEffect, useState, useRef, type RefObject } from "react";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

export type SecurityItem = {
  symbol: string;
  name: string;
  assetClass: "EQUITY" | "CRYPTO" | "CURNCY" | "COMM" | "GOVT" | "MACRO";
  exchange: string;
  description: string;
  command: string;
};

const CATEGORIES = [
  { label: "ALL ASSETS", value: "ALL" },
  { label: "EQUITIES", value: "EQUITY" },
  { label: "CRYPTO", value: "CRYPTO" },
  { label: "CURRENCIES", value: "CURNCY" },
  { label: "COMMODITIES", value: "COMM" },
  { label: "GOVT BONDS", value: "GOVT" },
  { label: "MACRO (FRED)", value: "MACRO" },
];

export default function SecurityFinderPanel({
  initialQuery = "",
  onSelectCommand,
  panelRef,
}: {
  initialQuery?: string;
  onSelectCommand?: (cmd: string) => void;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("ALL");
  const [results, setResults] = useState<SecurityItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setStatus("loading");
    const endpoint = `/api/secf?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`;

    fetchJsonWithRetry<{ results: SecurityItem[] }>(endpoint, undefined, {
      context: `PANEL:SECF:${query}:${category}`,
      retries: 2,
      initialDelayMs: 400,
    })
      .then((data) => {
        setResults(data.results || []);
        setSelectedIndex(0);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [query, category]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target && onSelectCommand) {
        onSelectCommand(target.command);
      }
    }
  };

  const getAssetBadgeClass = (assetClass: string) => {
    switch (assetClass) {
      case "EQUITY":
        return "fx-pill-active";
      case "CRYPTO":
        return "stream-status-live";
      case "CURNCY":
        return "macro-tf-active";
      case "COMM":
        return "legend-bid";
      case "GOVT":
        return "macro-stale-badge";
      default:
        return "";
    }
  };

  return (
    <section
      className="secf-panel"
      aria-label="SECF Universal Security & Economic Series Search"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="SECF // UNIVERSAL SECURITY & SERIES FINDER"
        title="SECURITY FINDER"
        subtitle={query ? `"${query}"` : undefined}
        sources={`${results.length} MATCHES`}
        status="live"
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">FILTER:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              className={category === cat.value ? "active" : ""}
              onClick={() => setCategory(cat.value)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        {/* Search Input Bar */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input
            ref={inputRef}
            type="text"
            className="fx-search-input"
            aria-label="Universal security and series search query"
            style={{
              flex: 1,
              fontSize: "12px",
              padding: "6px 10px",
              background: "#08090a",
              border: "1px solid var(--border)",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
            }}
            placeholder="TYPE TICKER, COMPANY NAME, CURRENCY, COMMODITY OR MACRO SERIES..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="edgar-search-btn"
              aria-label="Clear search input"
              style={{ fontSize: "10px", padding: "0 10px" }}
              onClick={() => setQuery("")}
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Results Matrix Table */}
        <div className="edgar-table-wrap" style={{ overflowX: "auto", maxWidth: "100%" }}>
          {status === "loading" && results.length === 0 ? (
            <p className="news-empty">Searching global securities catalog…</p>
          ) : results.length === 0 ? (
            <p className="news-empty">
              No matching securities found for &quot;{query}&quot; in category {category}.
            </p>
          ) : (
            <table className="edgar-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: "110px" }}>TICKER</th>
                  <th style={{ textAlign: "left" }}>SECURITY NAME</th>
                  <th style={{ textAlign: "center", width: "70px" }}>ASSET</th>
                  <th className="secf-col-exchange" style={{ textAlign: "left", width: "110px" }}>EXCHANGE</th>
                  <th className="secf-col-desc" style={{ textAlign: "left" }}>DESCRIPTION</th>
                  <th style={{ textAlign: "right", width: "75px" }}>LAUNCH</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => (
                  <tr
                    key={`${item.assetClass}-${item.symbol}-${idx}`}
                    className="edgar-row"
                    tabIndex={idx === selectedIndex ? 0 : -1}
                    role="row"
                    aria-selected={idx === selectedIndex}
                    style={{
                      cursor: "pointer",
                      background: idx === selectedIndex ? "rgba(224, 168, 53, 0.15)" : undefined,
                      outline: idx === selectedIndex ? "1px solid var(--accent)" : undefined,
                    }}
                    onClick={() => onSelectCommand?.(item.command)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <td style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
                      {item.symbol}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>
                      {item.name}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "2px",
                          background: "rgba(255,255,255,0.06)",
                          color:
                            item.assetClass === "EQUITY"
                              ? "var(--bid)"
                              : item.assetClass === "CRYPTO"
                              ? "var(--accent)"
                              : item.assetClass === "CURNCY"
                              ? "#00bcd4"
                              : item.assetClass === "COMM"
                              ? "#ffb300"
                              : "var(--muted)",
                        }}
                      >
                        {item.assetClass}
                      </span>
                    </td>
                    <td className="secf-col-exchange" style={{ color: "var(--muted)", fontSize: "11px" }}>
                      {item.exchange}
                    </td>
                    <td className="secf-col-desc" style={{ color: "var(--muted)", fontSize: "11px" }}>
                      {item.description}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Select ${item.symbol}`}
                        className="symbol-submit-btn"
                        style={{ fontSize: "9px", padding: "1px 6px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCommand?.(item.command);
                        }}
                      >
                        GO ↵
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <footer
        className="panel-footer"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "5px 10px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "var(--muted)",
          background: "#0a0c0e",
          flexShrink: 0,
        }}
      >
        <span>
          Use <strong style={{ color: "var(--accent)" }}>↑ / ↓</strong> to navigate,{" "}
          <strong style={{ color: "var(--accent)" }}>Enter</strong> to select
        </span>
        <span className="panel-footer-note">SECF Universal Directory · 10,000+ Instruments</span>
      </footer>
    </section>
  );
}

