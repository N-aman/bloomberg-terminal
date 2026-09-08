"use client";

import { useEffect, useState, type RefObject } from "react";
import type { VolatilityData } from "@/app/api/volatility/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

function renderSmileCurve(smile: VolatilityData["smile"]) {
  if (!smile || smile.length < 2) return null;
  const width = 280;
  const height = 90;
  const vols = smile.map((s) => s.impliedVol);
  const minVol = Math.min(...vols) * 0.9;
  const maxVol = Math.max(...vols) * 1.1;
  const range = maxVol - minVol || 1;

  const points = smile
    .map((s, idx) => {
      const x = (idx / (smile.length - 1)) * (width - 40) + 20;
      const y = height - ((s.impliedVol - minVol) / range) * (height - 30) - 15;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {smile.map((s, idx) => {
        const x = (idx / (smile.length - 1)) * (width - 40) + 20;
        const y = height - ((s.impliedVol - minVol) / range) * (height - 30) - 15;
        return (
          <g key={s.strikePercent}>
            <circle cx={x} cy={y} r="3.5" fill="#ffb400" />
            <text
              x={x}
              y={y - 8}
              fill="var(--text)"
              fontSize="9"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {s.impliedVol}%
            </text>
            <text
              x={x}
              y={height + 12}
              fill="var(--muted)"
              fontSize="8"
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {s.strikePercent}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function VolatilityPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<VolatilityData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  const loadData = () => {
    setStatus("loading");
    fetch("/api/volatility")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<VolatilityData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="volatility-panel"
      aria-label="Bloomberg Volatility Surface and Term Structure"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="VOL // VOLATILITY SURFACE & VIX STRUCTURE"
        title="CBOE VIX INDEX & IMPLIED VOLATILITY SKEW"
        subtitle="REALIZED VS IMPLIED VOLATILITY SPREAD"
        sources="CBOE & BLACK-SCHOLES IV"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            CALCULATING VOLATILITY CONE &amp; IMPLIED VOLATILITY SMILE...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD VOLATILITY BENCHMARKS.
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
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>CBOE VIX SPOT</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                {data.vixCurrent.toFixed(2)}
              </div>
              <div style={{ fontSize: "10px", color: data.vixChange >= 0 ? "var(--ask)" : "var(--bid)", marginTop: "2px" }}>
                {data.vixChange >= 0 ? "▲ +" : "▼ "}{data.vixChange.toFixed(2)} ({data.vixChangePercent.toFixed(1)}%)
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>30D REALIZED (HV)</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--accent)", marginTop: "2px" }}>
                {data.realizedVol30D.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Historical Trailing Vol
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>VOL RISK PREMIUM (IV-RV)</div>
              <div style={{ fontSize: "18px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                +{data.ivRvSpread.toFixed(2)} pts
              </div>
              <div style={{ fontSize: "9px", color: "var(--bid)", marginTop: "2px" }}>
                Implied Vol Premium
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>VOL REGIME</div>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)", marginTop: "4px" }}>
                {data.regime}
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "4px" }}>
                Market Risk Environment
              </div>
            </div>
          </div>

          {/* Smile Chart and History */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "12px",
            }}
          >
            {/* Smile / Skew Plot */}
            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px" }}>
                OPTIONS IMPLIED VOLATILITY SMILE (% OF SPOT)
              </div>
              <div style={{ display: "flex", justifyContent: "center", paddingBottom: "16px" }}>
                {renderSmileCurve(data.smile)}
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", textAlign: "center" }}>
                STRIKE (% OF CURRENT INDEX SPOT)
              </div>
            </div>

            {/* Historical VIX Observations */}
            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>
                RECENT VIX CLOSING HISTORY
              </div>
              <div className="edgar-table-wrap" style={{ maxHeight: "140px" }}>
                <table className="edgar-table">
                  <thead>
                    <tr>
                      <th>DATE</th>
                      <th style={{ textAlign: "right" }}>VIX CLOSE</th>
                      <th style={{ textAlign: "right" }}>DAILY CHG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.slice(-6).reverse().map((h, idx, arr) => {
                      const prevVal = arr[idx + 1]?.value ?? h.value;
                      const diff = h.value - prevVal;
                      return (
                        <tr key={h.date} className="edgar-row">
                          <td className="edgar-date-col">{h.date}</td>
                          <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                            {h.value.toFixed(2)}
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontFamily: "var(--font-mono)",
                              color: diff >= 0 ? "var(--ask)" : "var(--bid)",
                            }}
                          >
                            {diff >= 0 ? "+" : ""}{diff.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </section>
);
}

