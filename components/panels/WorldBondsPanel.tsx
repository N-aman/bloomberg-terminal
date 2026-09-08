"use client";

import { useEffect, useState, type RefObject } from "react";
import type { WorldBondsData, SovereignYield } from "@/app/api/world-bonds/route";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

export default function WorldBondsPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<WorldBondsData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  const loadData = () => {
    setStatus("loading");
    fetch("/api/world-bonds")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<WorldBondsData>;
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
      className="world-bonds-panel"
      aria-label="Bloomberg World Sovereign Bond Benchmark Matrix"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="WBON // WORLD SOVEREIGN BOND BENCHMARKS"
        title="SOVEREIGN YIELD CURVES & 10Y BENCHMARK SPREADS"
        subtitle="G10 SOVEREIGN DEBT MONITOR"
        sources="FRED INTERNATIONAL DEBT"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            FETCHING GLOBAL SOVEREIGN BENCHMARK YIELDS...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD WORLD SOVEREIGN BOND MATRIX.
          </div>
        )}

        {data && (
          <div>
          <div className="edgar-table-wrap">
            <table className="edgar-table">
              <thead>
                <tr>
                  <th style={{ width: "220px" }}>SOVEREIGN ISSUER</th>
                  <th style={{ textAlign: "right", width: "85px" }}>2Y YIELD</th>
                  <th style={{ textAlign: "right", width: "85px" }}>5Y YIELD</th>
                  <th style={{ textAlign: "right", width: "85px" }}>10Y YIELD</th>
                  <th style={{ textAlign: "right", width: "85px" }}>30Y YIELD</th>
                  <th style={{ textAlign: "right", width: "110px" }}>10Y SPREAD (BPS)</th>
                  <th style={{ textAlign: "right", width: "80px" }}>1D CHG</th>
                  <th style={{ textAlign: "right", width: "90px" }}>CURVE SHAPE</th>
                </tr>
              </thead>
              <tbody>
                {data.bonds.map((b) => {
                  const isUs = b.country === "US";
                  return (
                    <tr
                      key={b.country}
                      className="edgar-row"
                      style={{
                        background: isUs ? "rgba(255, 180, 0, 0.08)" : undefined,
                        borderLeft: isUs ? "3px solid var(--accent)" : undefined,
                      }}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px" }}>{b.flag}</span>
                          <span style={{ fontWeight: 700, color: isUs ? "var(--accent)" : "var(--text)" }}>
                            {b.name}
                          </span>
                          {isUs && (
                            <span
                              style={{
                                fontSize: "9px",
                                background: "var(--accent)",
                                color: "#000",
                                padding: "0 4px",
                                fontWeight: 700,
                                borderRadius: "2px",
                              }}
                            >
                              BENCHMARK
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {b.yield2Y.toFixed(2)}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {b.yield5Y.toFixed(2)}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>
                        {b.yield10Y.toFixed(2)}%
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {b.yield30Y.toFixed(2)}%
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color:
                            b.spreadVsUs10YBps === 0
                              ? "var(--muted)"
                              : b.spreadVsUs10YBps > 0
                              ? "var(--bid)"
                              : "var(--accent)",
                        }}
                      >
                        {b.spreadVsUs10YBps === 0
                          ? "PAR (0)"
                          : `${b.spreadVsUs10YBps > 0 ? "+" : ""}${b.spreadVsUs10YBps} bps`}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          color: b.change1D >= 0 ? "var(--bid)" : "var(--ask)",
                        }}
                      >
                        {b.change1D >= 0 ? "+" : ""}{b.change1D.toFixed(2)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: "2px",
                            color: b.curveShape === "NORMAL" ? "var(--bid)" : "var(--color-red)",
                            background:
                              b.curveShape === "NORMAL"
                                ? "rgba(0, 200, 115, 0.1)"
                                : "rgba(255, 68, 68, 0.1)",
                          }}
                        >
                          {b.curveShape}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  </section>
);
}

