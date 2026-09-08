"use client";

import { useEffect, useState, type RefObject } from "react";
import type { AnalystData } from "@/app/api/analyst/route";
import { fetchJsonWithRetry } from "@/lib/fetchWithRetry";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

const QUICK_TICKERS = ["AAPL", "NVDA", "TSLA", "MSFT", "PLTR", "AMZN", "GOOGL"];

export default function AnalystRecommendationsPanel({
  initialTicker = "AAPL",
  panelRef,
}: {
  initialTicker?: string;
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [data, setData] = useState<AnalystData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    if (initialTicker) setTicker(initialTicker.toUpperCase());
  }, [initialTicker]);

  const loadAnalystData = () => {
    setStatus("loading");
    fetchJsonWithRetry<AnalystData>(`/api/analyst?ticker=${ticker}`, undefined, {
      context: `PANEL:ANALYST:${ticker}`,
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
    loadAnalystData();
  }, [ticker]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchInput.trim().toUpperCase();
    if (clean) {
      setTicker(clean);
      setSearchInput("");
    }
  };

  const latest = data?.recommendations[0];
  const totalRecs = latest?.total || 1;

  const pct = (count: number) => ((count / totalRecs) * 100).toFixed(0);

  return (
    <section
      className="analyst-panel"
      aria-label="Bloomberg Analyst Recommendations and Targets"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="ANR // ANALYST RECOMMENDATIONS & TARGETS"
        title={`${ticker} CONSENSUS`}
        subtitle="12M PRICE TARGETS"
        sources="FINNHUB CONSENSUS"
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
            CALCULATING {ticker} ANALYST CONSENSUS...
          </div>
        )}

        {status === "error" && (
          <div className="panel-error" style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>FAILED TO LOAD ANALYST RECOMMENDATIONS FOR {ticker}.</span>
            <button type="button" className="fx-search-clear" onClick={loadAnalystData}>
              ↻ RETRY
            </button>
          </div>
        )}

        {data && status !== "loading" && (
          <div>
          {/* Top Row: Consensus Badge & Price Target Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginBottom: "12px" }}>
            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>CONSENSUS RATING</div>
              <div
                style={{
                  color: data.consensus.includes("BUY") ? "var(--bid)" : data.consensus === "HOLD" ? "var(--accent)" : "var(--ask)",
                  fontSize: "16px",
                  fontWeight: "bold",
                  marginTop: "2px",
                }}
              >
                {data.consensus}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                SCORE: {data.consensusScore} / 5.0 (1.0 = Strong Buy)
              </div>
            </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>MEAN 12M TARGET</div>
              <div style={{ color: "var(--text)", fontSize: "16px", fontWeight: "bold", marginTop: "2px" }}>
                ${data.priceTarget.targetMean.toFixed(2)}
              </div>
              <div
                style={{
                  color: data.priceTarget.upsidePercent >= 0 ? "var(--bid)" : "var(--ask)",
                  fontSize: "10px",
                  marginTop: "2px",
                  fontWeight: 600,
                }}
              >
                {data.priceTarget.upsidePercent >= 0 ? `▲ +${data.priceTarget.upsidePercent}%` : `▼ ${data.priceTarget.upsidePercent}%`} VS CURRENT (${data.currentPrice.toFixed(2)})
              </div>
            </div>

            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px" }}>
              <div style={{ color: "var(--muted)", fontSize: "10px", letterSpacing: "0.08em" }}>TARGET RANGE (HIGH / LOW)</div>
              <div style={{ color: "var(--accent)", fontSize: "14px", fontWeight: "bold", marginTop: "2px" }}>
                ${data.priceTarget.targetHigh.toFixed(2)} / ${data.priceTarget.targetLow.toFixed(2)}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                MEDIAN: ${data.priceTarget.targetMedian.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Consensus Distribution Bar */}
          {latest && (
            <div style={{ background: "#0d0e10", border: "1px solid var(--border)", padding: "10px 12px", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
                <span style={{ color: "var(--accent)", fontWeight: "bold", letterSpacing: "0.06em", fontSize: "10px" }}>
                  RECOMMENDATION BREAKDOWN ({latest.total} ANALYSTS)
                </span>
                <span style={{ color: "var(--muted)", fontSize: "10px" }}>PERIOD: {latest.period}</span>
              </div>

              {/* Stacked Progress Bar */}
              <div style={{ display: "flex", height: "20px", width: "100%", overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ width: `${pct(latest.strongBuy)}%`, background: "#3ecf6e", color: "#000", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }} title={`Strong Buy: ${latest.strongBuy}`}>
                  {latest.strongBuy > 0 ? `${latest.strongBuy}` : ""}
                </div>
                <div style={{ width: `${pct(latest.buy)}%`, background: "#27914e", color: "#fff", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }} title={`Buy: ${latest.buy}`}>
                  {latest.buy > 0 ? `${latest.buy}` : ""}
                </div>
                <div style={{ width: `${pct(latest.hold)}%`, background: "#e0a835", color: "#000", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }} title={`Hold: ${latest.hold}`}>
                  {latest.hold > 0 ? `${latest.hold}` : ""}
                </div>
                <div style={{ width: `${pct(latest.sell)}%`, background: "#e05353", color: "#fff", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }} title={`Sell: ${latest.sell}`}>
                  {latest.sell > 0 ? `${latest.sell}` : ""}
                </div>
                <div style={{ width: `${pct(latest.strongSell)}%`, background: "#991b1b", color: "#fff", fontSize: "10px", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center" }} title={`Strong Sell: ${latest.strongSell}`}>
                  {latest.strongSell > 0 ? `${latest.strongSell}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "8px", fontSize: "10px" }}>
                <span style={{ color: "#3ecf6e" }}>■ STRONG BUY ({latest.strongBuy})</span>
                <span style={{ color: "#27914e" }}>■ BUY ({latest.buy})</span>
                <span style={{ color: "#e0a835" }}>■ HOLD ({latest.hold})</span>
                <span style={{ color: "#e05353" }}>■ SELL ({latest.sell})</span>
                <span style={{ color: "#991b1b" }}>■ STRONG SELL ({latest.strongSell})</span>
              </div>
            </div>
          )}

          {/* Historical Trend Table */}
          <div style={{ background: "#0d0e10", border: "1px solid var(--border)" }}>
            <div style={{ background: "#111214", padding: "6px 12px", borderBottom: "1px solid var(--border)", color: "var(--accent)", fontWeight: "bold", fontSize: "10px", letterSpacing: "0.08em" }}>
              HISTORICAL CONSENSUS SHIFTS (MONTH-OVER-MONTH)
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "right" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
                  <th style={{ padding: "6px 12px", textAlign: "left", fontWeight: 700 }}>PERIOD</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>STRONG BUY</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>BUY</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>HOLD</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>SELL</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>STRONG SELL</th>
                  <th style={{ padding: "6px 12px", fontWeight: 700 }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {data.recommendations.map((rec, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1a1d21" }}>
                    <td style={{ padding: "6px 12px", textAlign: "left", color: "var(--text)", fontWeight: 500 }}>{rec.period}</td>
                    <td style={{ padding: "6px 12px", color: "#3ecf6e" }}>{rec.strongBuy}</td>
                    <td style={{ padding: "6px 12px", color: "#27914e" }}>{rec.buy}</td>
                    <td style={{ padding: "6px 12px", color: "#e0a835" }}>{rec.hold}</td>
                    <td style={{ padding: "6px 12px", color: "#e05353" }}>{rec.sell}</td>
                    <td style={{ padding: "6px 12px", color: "#991b1b" }}>{rec.strongSell}</td>
                    <td style={{ padding: "6px 12px", color: "var(--text)", fontWeight: "bold" }}>{rec.total}</td>
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
