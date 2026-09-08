"use client";

import { useEffect, useState, type RefObject } from "react";
import type { FxMatrixData } from "@/app/api/fx-matrix/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const PRESET_BASKETS = [
  { id: "G8", label: "G8 MAJORS", desc: "USD, EUR, GBP, JPY, CHF, CAD, AUD, INR" },
  { id: "EM", label: "EM EMERGING", desc: "USD, CNY, INR, BRL, MXN, ZAR, TRY, KRW" },
  { id: "APAC", label: "APAC ASIA", desc: "USD, JPY, CNY, HKD, SGD, KRW, INR, AUD" },
  { id: "EUROPE", label: "EUROPE", desc: "EUR, GBP, CHF, SEK, NOK, PLN, CZK, USD" },
] as const;

const AVAILABLE_CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
  "INR", "CNY", "HKD", "SGD", "KRW", "BRL", "MXN", "ZAR",
  "TRY", "SEK", "NOK", "PLN", "CZK", "DKK", "HUF", "ILS",
  "AED", "SAR", "THB", "MYR", "IDR", "PHP"
];

export default function FxCrossMatrixPanel({
  panelRef,
  onSelectPair,
}: {
  panelRef?: RefObject<HTMLElement | null>;
  onSelectPair?: (base: string, quote: string) => void;
}) {
  const [activeBasket, setActiveBasket] = useState<string>("G8");
  const [customCurrencies, setCustomCurrencies] = useState<string[]>([
    "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "INR"
  ]);
  const [data, setData] = useState<FxMatrixData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [addInput, setAddInput] = useState("");

  const loadData = (basketId?: string, curList?: string[]) => {
    setStatus("loading");
    let url = "/api/fx-matrix";

    const b = basketId ?? activeBasket;
    const list = curList ?? customCurrencies;

    if (b === "CUSTOM") {
      url += `?currencies=${encodeURIComponent(list.join(","))}`;
    } else {
      url += `?basket=${b}`;
    }

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FxMatrixData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
        if (d.currencies && b !== "CUSTOM") {
          setCustomCurrencies(d.currencies);
        }
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    loadData("G8");
    const interval = setInterval(() => loadData(), 300000); // 5-min refresh
    return () => clearInterval(interval);
  }, []);

  const handleSelectBasket = (bId: string) => {
    setActiveBasket(bId);
    loadData(bId);
  };

  const handleAddCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    const code = addInput.trim().toUpperCase();
    if (!code || code.length !== 3) return;

    if (customCurrencies.includes(code)) {
      setAddInput("");
      return;
    }

    if (customCurrencies.length >= 10) {
      alert("Maximum 10 currencies can be crossed in matrix.");
      return;
    }

    const updated = [...customCurrencies, code];
    setCustomCurrencies(updated);
    setActiveBasket("CUSTOM");
    setAddInput("");
    loadData("CUSTOM", updated);
  };

  const handleRemoveCurrency = (code: string) => {
    if (customCurrencies.length <= 2) {
      alert("A minimum of 2 currencies is required for a matrix.");
      return;
    }
    const updated = customCurrencies.filter((c) => c !== code);
    setCustomCurrencies(updated);
    setActiveBasket("CUSTOM");
    loadData("CUSTOM", updated);
  };

  const currencies = data?.currencies ?? customCurrencies;

  const formatRate = (rate: number): string => {
    if (rate >= 100) return rate.toFixed(2);
    if (rate >= 1) return rate.toFixed(4);
    return rate.toFixed(4);
  };

  return (
    <section
      className="fx-matrix-panel"
      aria-label="Bloomberg Foreign Exchange Cross-Rate Matrix"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="FXC // FOREIGN EXCHANGE CROSS MATRIX"
        title={`${currencies.length}×${currencies.length} CURRENCY MATRIX`}
        subtitle={data?.date}
        sources="FRANKFURTER ECB RATES"
        status={status}
        simulated={Boolean(data?.simulated)}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
          <span className="picker-label">BASKET:</span>
          {PRESET_BASKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              className={activeBasket === b.id ? "active" : ""}
              onClick={() => handleSelectBasket(b.id)}
              title={b.desc}
            >
              {b.label}
            </button>
          ))}
          <button
            type="button"
            className={activeBasket === "CUSTOM" ? "active" : ""}
            onClick={() => setActiveBasket("CUSTOM")}
          >
            CUSTOM ({customCurrencies.length})
          </button>
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">
        {/* Custom Currency Adder Bar if activeBasket === CUSTOM */}
        {activeBasket === "CUSTOM" && (
          <form
            onSubmit={handleAddCurrency}
            style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}
          >
            <input
              type="text"
              className="fx-search-input"
              style={{ width: "80px", textTransform: "uppercase" }}
              placeholder="+ CCY"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value.toUpperCase())}
              maxLength={3}
              list="fxc-supported-currencies"
            />
            <button type="submit" className="fx-search-clear">
              ADD
            </button>
            <datalist id="fxc-supported-currencies">
              {AVAILABLE_CURRENCIES.filter((c) => !customCurrencies.includes(c)).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </form>
        )}

      {/* Active Currency Removable Pills Strip */}
      <div
        style={{
          padding: "6px 12px",
          background: "#0a0b0d",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px",
          fontSize: "10px",
        }}
      >
        <span style={{ color: "var(--muted)", fontWeight: "bold", fontSize: "9px" }}>
          ACTIVE ({currencies.length}/10):
        </span>
        {currencies.map((c) => (
          <span
            key={c}
            style={{
              background: "#111214",
              border: "1px solid var(--border)",
              color: "var(--text)",
              padding: "1px 6px",
              borderRadius: "2px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "9.5px",
            }}
          >
            <strong style={{ color: "var(--accent)" }}>{c}</strong>
            <button
              type="button"
              onClick={() => handleRemoveCurrency(c)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                cursor: "pointer",
                padding: "0 1px",
                lineHeight: 1,
                fontSize: "11px",
              }}
              title={`Remove ${c} from matrix`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {status === "loading" && !data && (
        <div className="panel-loading" style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
          FETCHING CROSS-RATE MATRIX ({activeBasket})...
        </div>
      )}

      {status === "error" && !data && (
        <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
          FAILED TO LOAD FX CROSS-RATE MATRIX.
        </div>
      )}

      {data && (
        <div style={{ padding: "12px" }}>
          <div style={{ background: "#0d0e10", border: "1px solid var(--border)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5px", textAlign: "right" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  <th style={{ padding: "5px 5px", textAlign: "left", color: "var(--accent)", fontWeight: 700, minWidth: "45px" }}>
                    BASE\QUOTE
                  </th>
                  {currencies.map((quote) => (
                    <th key={quote} style={{ padding: "5px 5px", fontWeight: 700, minWidth: "48px" }}>
                      {quote}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currencies.map((base) => (
                  <tr key={base} style={{ borderBottom: "1px solid #1a1d21" }}>
                    <td style={{ padding: "5px 5px", textAlign: "left", color: "var(--accent)", fontWeight: "bold" }}>
                      {base}
                    </td>
                    {currencies.map((quote) => {
                      const isDiagonal = base === quote;
                      const rate = data.matrix[base]?.[quote] ?? 1.0;
                      return (
                        <td
                          key={quote}
                          style={{
                            padding: "5px 5px",
                            color: isDiagonal ? "var(--muted)" : "var(--text)",
                            fontWeight: isDiagonal ? "normal" : "500",
                            background: isDiagonal ? "#151719" : "transparent",
                            cursor: isDiagonal ? "default" : "pointer",
                          }}
                          onClick={() => {
                            if (!isDiagonal) onSelectPair?.(base, quote);
                          }}
                          title={isDiagonal ? undefined : `Click to route: FX ${base} ${quote}`}
                        >
                          {isDiagonal ? "1.0000" : formatRate(rate)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "10px", color: "var(--muted)" }}>
            <span>Tip: Click any off-diagonal cell to view the bilateral pair exchange rate details (FX &lt;BASE&gt; &lt;QUOTE&gt;).</span>
            <span>Date: {data.date}</span>
          </div>
        </div>
      )}
    </div>
  </section>
);
}
