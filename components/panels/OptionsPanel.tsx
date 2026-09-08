"use client";

import { useEffect, useState, type RefObject } from "react";
import type { OptionChain, StrikeRow } from "@/lib/providers/options";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_UNDERLYINGS = ["AAPL", "NVDA", "TSLA", "MSFT", "SPY", "BTC"];
const EXPIRATION_TABS = [
  { label: "7D", dte: 7 },
  { label: "30D", dte: 30 },
  { label: "60D", dte: 60 },
  { label: "90D", dte: 90 },
];

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function OptionsPanel({
  initialSymbol = "AAPL",
  panelRef,
}: {
  initialSymbol?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [dte, setDte] = useState(30);
  const [data, setData] = useState<OptionChain | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (initialSymbol) setSymbol(initialSymbol.toUpperCase());
  }, [initialSymbol]);

  useEffect(() => {
    setStatus("loading");
    fetch(`/api/options?symbol=${symbol}&dte=${dte}`)
      .then((r) => r.json() as Promise<OptionChain & { error?: string }>)
      .then((d) => {
        if ("error" in d && d.error) throw new Error(d.error);
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, [symbol, dte]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setSymbol(clean);
      setSearchInput("");
    }
  };

  const strikes = data?.strikes ?? [];
  const spot = data?.spotPrice ?? 0;

  return (
    <section
      className="options-panel"
      aria-label="Options Chain & Derivatives Monitor"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="OMON // OPTIONS CHAIN & BLACK-SCHOLES GREEKS"
        title={`${symbol} OPTIONS MONITOR`}
        subtitle={data ? `SPOT: $${fmt(data.spotPrice)} · EXP: ${data.expirationDate} (${data.daysToExpiry}D)` : undefined}
        sources="ALPACA IEX + BLACK-SCHOLES"
        status={status}
        tickers={QUICK_UNDERLYINGS}
        selectedTicker={symbol}
        onSelectTicker={(t) => setSymbol(t)}
        inputTicker={searchInput}
        onInputTickerChange={setSearchInput}
        onTickerSubmit={handleSearch}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span className="picker-label">EXPIRY:</span>
          {EXPIRATION_TABS.map((tab) => (
            <button
              key={tab.dte}
              type="button"
              className={dte === tab.dte ? "active" : ""}
              onClick={() => setDte(tab.dte)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        {/* Options Overview Strip */}
        {data && (
          <div className="edgar-meta-strip">
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">IMPLIED VOL (IV)</span>
              <span className="edgar-meta-val" style={{ color: "var(--accent)" }}>
                {data.impliedVolIndexPct.toFixed(1)}%
              </span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">PUT / CALL RATIO</span>
              <span className="edgar-meta-val">
                {data.putCallRatio.toFixed(2)}
              </span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">MAX PAIN STRIKE</span>
              <span className="edgar-meta-val" style={{ color: "var(--bid)" }}>
                ${fmt(data.maxPainStrike)}
              </span>
            </div>
            <div className="edgar-meta-item">
              <span className="edgar-meta-label">TOTAL STRIKES</span>
              <span className="edgar-meta-val">{strikes.length} STRIKES</span>
            </div>
          </div>
        )}

        {/* Dual-Sided Options Matrix */}
        {status === "loading" && !data ? (
          <p className="news-empty">Calculating Black-Scholes Greeks &amp; option pricing…</p>
        ) : strikes.length === 0 ? (
          <p className="news-empty">No options chain available for {symbol}.</p>
        ) : (
          <div className="options-table-wrap">
            <table className="options-matrix-table">
              <thead>
                <tr>
                  {/* CALLS HEADER */}
                  <th colSpan={6} style={{ textAlign: "center", background: "#3ecf6e15", color: "var(--bid)" }}>
                    CALLS
                  </th>
                  {/* STRIKE */}
                  <th style={{ textAlign: "center", background: "#111317", width: "90px" }}>
                    STRIKE
                  </th>
                  {/* PUTS HEADER */}
                  <th colSpan={6} style={{ textAlign: "center", background: "#e2555515", color: "var(--ask)" }}>
                    PUTS
                  </th>
                </tr>
                <tr className="options-sub-head">
                  {/* Calls cols */}
                  <th>BID</th>
                  <th>ASK</th>
                  <th>IV%</th>
                  <th>DELTA (Δ)</th>
                  <th>THETA (Θ)</th>
                  <th>VOL</th>

                  {/* Strike col */}
                  <th style={{ textAlign: "center" }}>$</th>

                  {/* Puts cols */}
                  <th>BID</th>
                  <th>ASK</th>
                  <th>IV%</th>
                  <th>DELTA (Δ)</th>
                  <th>THETA (Θ)</th>
                  <th>VOL</th>
                </tr>
              </thead>
              <tbody>
                {strikes.map((row, idx) => {
                  const isCallItm = spot >= row.strike;
                  const isPutItm = spot < row.strike;
                  const isAtm = Math.abs(spot - row.strike) <= (spot * 0.015);

                  return (
                    <tr
                      key={`${row.strike}-${idx}`}
                      className={`options-row${isAtm ? " options-row-atm" : ""}`}
                    >
                      {/* CALL COLUMNS */}
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`} style={{ color: "var(--bid)" }}>
                        ${fmt(row.call.bid)}
                      </td>
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`}>
                        ${fmt(row.call.ask)}
                      </td>
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`} style={{ color: "var(--muted)" }}>
                        {row.call.ivPct.toFixed(1)}%
                      </td>
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`} style={{ color: "#d8dee3", fontWeight: 700 }}>
                        {row.call.greeks.delta.toFixed(3)}
                      </td>
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`} style={{ color: "var(--muted)" }}>
                        {row.call.greeks.theta.toFixed(2)}
                      </td>
                      <td className={`options-call-cell ${isCallItm ? "options-itm" : ""}`} style={{ color: "var(--muted)", fontSize: "10px" }}>
                        {row.call.volume.toLocaleString()}
                      </td>

                      {/* STRIKE COLUMN */}
                      <td className={`options-strike-cell${isAtm ? " options-strike-atm" : ""}`}>
                        ${fmt(row.strike, row.strike > 1000 ? 0 : 2)}
                      </td>

                      {/* PUT COLUMNS */}
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`} style={{ color: "var(--ask)" }}>
                        ${fmt(row.put.bid)}
                      </td>
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`}>
                        ${fmt(row.put.ask)}
                      </td>
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`} style={{ color: "var(--muted)" }}>
                        {row.put.ivPct.toFixed(1)}%
                      </td>
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`} style={{ color: "#d8dee3", fontWeight: 700 }}>
                        {row.put.greeks.delta.toFixed(3)}
                      </td>
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`} style={{ color: "var(--muted)" }}>
                        {row.put.greeks.theta.toFixed(2)}
                      </td>
                      <td className={`options-put-cell ${isPutItm ? "options-itm" : ""}`} style={{ color: "var(--muted)", fontSize: "10px" }}>
                        {row.put.volume.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

