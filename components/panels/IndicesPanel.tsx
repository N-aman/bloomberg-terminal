"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { IndicesData } from "@/app/api/indices/route";
import {
  MAJOR_CURRENCY_CODES,
  WORLD_CURRENCIES,
  CURRENCY_MAP,
} from "@/lib/currencies";

import PanelTitlebar from "@/components/ui/PanelTitlebar";

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtLarge(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  return `$${fmt(n)}`;
}
function changeClass(v: number) {
  return v > 0 ? "wei-pos" : v < 0 ? "wei-neg" : "";
}
function changeSign(v: number) {
  return v > 0 ? `+${fmt(v)}` : fmt(v);
}

const QUICK_MAJOR_PILLS = [
  "USD", "EUR", "GBP", "JPY", "INR", "AED", "SAR", "CNY", "CAD", "AUD", "CHF", "SGD"
];

export default function IndicesPanel({
  initialBase = "USD",
  initialTarget = "",
  fxPair,
  panelRef,
}: {
  initialBase?: string;
  initialTarget?: string;
  fxPair?: { from: string; to: string };
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<IndicesData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [baseCcy, setBaseCcy] = useState((fxPair?.from || initialBase).toUpperCase());
  const [targetCcy, setTargetCcy] = useState((fxPair?.to || initialTarget).toUpperCase());
  const [searchFilter, setSearchFilter] = useState("");
  const [amount, setAmount] = useState<number>(1);

  // Sync state if props change from command bar
  useEffect(() => {
    if (fxPair) {
      if (fxPair.from) setBaseCcy(fxPair.from.toUpperCase());
      if (fxPair.to !== undefined) setTargetCcy(fxPair.to.toUpperCase());
    } else {
      if (initialBase) setBaseCcy(initialBase.toUpperCase());
      if (initialTarget !== undefined) setTargetCcy(initialTarget.toUpperCase());
    }
  }, [fxPair, initialBase, initialTarget]);

  // Fetch FX rates whenever baseCcy changes
  useEffect(() => {
    setStatus("loading");
    fetch(`/api/indices?from=${baseCcy}`)
      .then((r) => r.json() as Promise<IndicesData & { error?: string }>)
      .then((d) => {
        if ("error" in d && d.error) throw new Error(d.error);
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  }, [baseCcy]);

  const fx = data?.fx?.rates ?? {};
  const crypto = data?.crypto;
  const sp500 = data?.sp500;

  // Single pair conversion rate if targetCcy is set
  const singleRate = targetCcy && fx[targetCcy] !== undefined ? fx[targetCcy] : null;

  // Currencies to display in the rates list
  const displayedRates = useMemo(() => {
    const q = searchFilter.trim().toUpperCase();
    const entries = Object.entries(fx).filter(([code]) => code !== baseCcy);
    const majorCodes = MAJOR_CURRENCY_CODES ?? [
      "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
      "CNY", "INR", "SGD", "HKD", "AED", "SAR", "BRL", "MXN",
      "KRW", "SEK", "NOK", "ZAR", "TRY"
    ];

    if (!q) {
      return entries.filter(([code]) =>
        majorCodes.includes(code) || code === targetCcy
      );
    }

    return entries.filter(([code]) => {
      const info = CURRENCY_MAP?.get(code);
      const name = info?.name.toUpperCase() || "";
      return code.includes(q) || name.includes(q);
    });
  }, [fx, baseCcy, targetCcy, searchFilter]);

  const majorList = useMemo(() => (WORLD_CURRENCIES ?? []).filter((c) => c.isMajor), []);
  const allOtherList = useMemo(() => (WORLD_CURRENCIES ?? []).filter((c) => !c.isMajor), []);

  return (
    <section
      className="wei-panel"
      aria-label="World market overview and FX"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="WEI // GLOBAL MARKETS & 160+ FX RATES"
        title="GLOBAL MARKETS"
        subtitle={baseCcy}
        sources="FRANKFURTER + COINGECKO"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data ? (
          <p className="news-empty">Fetching global market & FX data…</p>
        ) : status === "error" && !data ? (
          <p className="news-empty">Global markets & FX rates currently unavailable.</p>
        ) : (
          <div>
          {/* Equity Indices & S&P 500 */}
          <div>
            <div className="wei-section-label">GLOBAL MARKET BENCHMARKS</div>
            {sp500 && (
              <div className="wei-row">
                <span className="wei-ticker">S&P 500 (US)</span>
                <span className="wei-value">{fmt(sp500.value)}</span>
                <span className="wei-date">AS OF {sp500.date}</span>
              </div>
            )}
            {crypto && (
              <div className="wei-row">
                <span className="wei-ticker">CRYPTO TOTAL MCAP</span>
                <span className="wei-value">{fmtLarge(crypto.totalMarketCapUsd)}</span>
                <span className={`wei-change ${changeClass(crypto.marketCapChange24h)}`}>
                  {changeSign(crypto.marketCapChange24h)}%
                </span>
              </div>
            )}
          </div>

          {/* Currency Converter & Cross Rates */}
          <div>
            <div className="wei-section-label">FOREIGN EXCHANGE & 160+ FX CROSSES</div>

            {/* Quick Major Currency Selector Pills */}
            <div className="fx-quick-pills">
              <span className="fx-quick-label">BASE:</span>
              {QUICK_MAJOR_PILLS.map((ccy) => (
                <button
                  key={ccy}
                  type="button"
                  className={`fx-pill${baseCcy === ccy ? " fx-pill-active" : ""}`}
                  onClick={() => {
                    setBaseCcy(ccy);
                    if (targetCcy === ccy) setTargetCcy("");
                  }}
                >
                  {ccy}
                </button>
              ))}
            </div>

            {/* Base Currency & Target Currency Themed Selectors */}
            <div className="fx-selectors-grid">
              <div className="fx-select-group">
                <label htmlFor="fx-base-select" className="fx-label">BASE CCY</label>
                <select
                  id="fx-base-select"
                  className="fx-select"
                  value={baseCcy}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBaseCcy(next);
                    if (targetCcy === next) setTargetCcy("");
                  }}
                >
                  <optgroup label="⭐ MAJOR CURRENCIES">
                    {majorList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name} {c.symbol ? `(${c.symbol})` : ""}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🌍 ALL OTHER WORLD CURRENCIES">
                    {allOtherList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="fx-select-group">
                <label htmlFor="fx-target-select" className="fx-label">CONVERT TO (OPTIONAL)</label>
                <select
                  id="fx-target-select"
                  className="fx-select"
                  value={targetCcy}
                  onChange={(e) => setTargetCcy(e.target.value)}
                >
                  <option value="">-- ALL CROSS RATES --</option>
                  <optgroup label="⭐ MAJOR CURRENCIES">
                    {majorList
                      .filter((c) => c.code !== baseCcy)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name} {c.symbol ? `(${c.symbol})` : ""}
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🌍 ALL OTHER WORLD CURRENCIES">
                    {allOtherList
                      .filter((c) => c.code !== baseCcy)
                      .map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* Target Pair Calculator Card */}
            {targetCcy && singleRate !== null && (
              <div className="fx-conversion-card">
                <div className="fx-amount-input-wrap">
                  <label htmlFor="fx-calc-amt" className="fx-label">AMOUNT IN {baseCcy}:</label>
                  <input
                    id="fx-calc-amt"
                    className="fx-input"
                    type="number"
                    min="0"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="fx-conv-main">
                  <span>{fmt(amount)} {baseCcy} =</span>
                  <span className="fx-conv-result">
                    {fmt(amount * singleRate, singleRate < 0.01 ? 4 : 2)} {targetCcy}
                  </span>
                </div>
                <div className="fx-conv-sub">
                  <span>1 {baseCcy} = {fmt(singleRate, 4)} {targetCcy}</span>
                  <span style={{ margin: "0 6px" }}>•</span>
                  <span>1 {targetCcy} = {fmt(1 / singleRate, 4)} {baseCcy}</span>
                </div>
              </div>
            )}

            {/* Search Filter for 160+ Currencies */}
            <div className="fx-search-bar">
              <input
                type="text"
                className="fx-search-input"
                placeholder="SEARCH 160+ CURRENCIES (e.g. INR, JPY, EUR, POUND)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
              {searchFilter && (
                <button
                  type="button"
                  className="fx-search-clear"
                  onClick={() => setSearchFilter("")}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtered FX Cross Rates Table */}
            <div className="fx-rates-grid">
              {displayedRates.length === 0 ? (
                <div className="news-empty" style={{ padding: "8px 0" }}>
                  No matching currencies found for &quot;{searchFilter}&quot;.
                </div>
              ) : (
                displayedRates.map(([code, rate]) => {
                  const info = CURRENCY_MAP?.get(code);
                  const isSelected = targetCcy === code;
                  return (
                    <div
                      key={code}
                      className={`wei-row fx-row-clickable${isSelected ? " fx-row-selected" : ""}`}
                      onClick={() => setTargetCcy(isSelected ? "" : code)}
                      title={`Click to convert ${baseCcy} to ${code}`}
                    >
                      <span className="wei-ticker">
                        {baseCcy}/{code}
                        {info && <span className="fx-ccy-name"> · {info.name}</span>}
                      </span>
                      <span className="wei-value">
                        {typeof rate === "number" ? fmt(rate, rate < 0.01 ? 4 : 4) : "—"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {data?.fx?.date && (
              <div className="wei-date" style={{ marginTop: 8 }}>
                INTERBANK / MARKET RATES AS OF {data.fx.date}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  </section>
);
}
