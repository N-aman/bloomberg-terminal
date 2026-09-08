"use client";

import { useEffect, useState, type RefObject } from "react";
import type { CorrelationMatrixResult } from "@/lib/quant/correlation";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

type CorrelationData = CorrelationMatrixResult & {
  assetNames: Record<string, string>;
  stale: boolean;
};

export default function CorrelationMatrixPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<CorrelationData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");
  const [windowDays, setWindowDays] = useState<number>(30);

  const loadData = (w: number) => {
    setStatus("loading");
    fetch(`/api/correlation?window=${w}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<CorrelationData>;
      })
      .then((d) => {
        setData(d);
        setStatus(d.stale ? "stale" : "live");
      })
      .catch(() => setStatus("error"));
  };

  useEffect(() => {
    loadData(windowDays);
  }, [windowDays]);

  const getHeatmapColor = (corr: number) => {
    if (corr >= 0.75) return { bg: "rgba(0, 200, 115, 0.28)", text: "#00e682", border: "rgba(0, 200, 115, 0.4)" };
    if (corr >= 0.40) return { bg: "rgba(0, 200, 115, 0.14)", text: "var(--bid)", border: "rgba(0, 200, 115, 0.2)" };
    if (corr >= 0.10) return { bg: "rgba(0, 200, 115, 0.06)", text: "var(--text)", border: "transparent" };
    if (corr <= -0.40) return { bg: "rgba(255, 68, 68, 0.25)", text: "#ff4d4d", border: "rgba(255, 68, 68, 0.4)" };
    if (corr <= -0.10) return { bg: "rgba(255, 68, 68, 0.12)", text: "var(--ask)", border: "rgba(255, 68, 68, 0.2)" };
    return { bg: "#101216", text: "var(--muted)", border: "transparent" };
  };

  return (
    <section
      className="correlation-panel"
      aria-label="Bloomberg Asset Correlation Matrix"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="CORR // CROSS-ASSET PEARSON CORRELATION MATRIX"
        title="MULTI-ASSET ROLLING RETURN CORRELATION"
        subtitle={`DAILY LOG-RETURNS (${windowDays}-DAY)`}
        sources="PEARSON LOG-RETURN ENGINE"
        status={status}
      >
        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
          <span className="picker-label">WINDOW:</span>
          {[30, 90, 365].map((w) => (
            <button
              key={w}
              type="button"
              className={windowDays === w ? "active" : ""}
              onClick={() => setWindowDays(w)}
            >
              {w === 365 ? "1Y (365D)" : `${w}D`}
            </button>
          ))}
        </div>
      </PanelTitlebar>

      <div className="panel-content-body">

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "10px" }}>
          <span style={{ color: "#00e682" }}>■ STRONG POS (+0.70)</span>
          <span style={{ color: "var(--muted)" }}>■ UNCORRELATED (~0.0)</span>
          <span style={{ color: "#ff4d4d" }}>■ INVERSE (-0.40)</span>
          <button type="button" className="fx-search-clear" onClick={() => loadData(windowDays)}>
            ↻ REFRESH
          </button>
        </div>

        {status === "loading" && !data && (
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
          COMPUTING LOG-RETURN CORRELATIONS ACROSS CROSS-ASSET CATALOG...
        </div>
      )}

      {status === "error" && !data && (
        <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
          FAILED TO CALCULATE ASSET CORRELATION MATRIX.
        </div>
      )}

      {data && (
        <div style={{ padding: "12px" }}>
          <div className="edgar-table-wrap">
            <table className="edgar-table" style={{ textAlign: "center" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", width: "100px" }}>ASSET</th>
                  {data.assets.map((a) => (
                    <th key={a} style={{ textAlign: "center", width: "70px", fontFamily: "var(--font-mono)" }}>
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.assets.map((rowAsset, i) => (
                  <tr key={rowAsset} className="edgar-row">
                    <td style={{ textAlign: "left" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 700, color: "var(--accent)" }}>{rowAsset}</span>
                        <span style={{ fontSize: "9px", color: "var(--muted)" }}>
                          {data.assetNames[rowAsset] || ""}
                        </span>
                      </div>
                    </td>
                    {data.matrix[i].map((corr, j) => {
                      const isDiag = i === j;
                      const style = isDiag
                        ? { bg: "#16181b", text: "var(--muted)", border: "none" }
                        : getHeatmapColor(corr);

                      return (
                        <td
                          key={`${rowAsset}-${data.assets[j]}`}
                          style={{
                            background: style.bg,
                            color: style.text,
                            border: `1px solid ${style.border}`,
                            fontFamily: "var(--font-mono)",
                            fontSize: "11px",
                            fontWeight: isDiag ? 400 : 700,
                            padding: "6px 2px",
                          }}
                        >
                          {isDiag ? "1.00" : corr > 0 ? `+${corr.toFixed(2)}` : corr.toFixed(2)}
                        </td>
                      );
                    })}
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

