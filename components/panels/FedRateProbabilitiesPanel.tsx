"use client";

import { useEffect, useState, type RefObject } from "react";
import type { FedRatesData, FomcMeetingProbability } from "@/types/terminal";
import PanelTitlebar from "@/components/ui/PanelTitlebar";

export default function FedRateProbabilitiesPanel({
  panelRef,
}: {
  panelRef?: RefObject<HTMLElement | null>;
}) {
  const [data, setData] = useState<FedRatesData | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "stale" | "error">("loading");

  const loadData = () => {
    setStatus("loading");
    fetch("/api/fed-rates")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<FedRatesData>;
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
      className="fed-rates-panel"
      aria-label="Bloomberg World Interest Rate Probabilities"
      ref={panelRef as RefObject<HTMLElement>}
    >
      <PanelTitlebar
        kicker="WIRP // WORLD INTEREST RATE PROBABILITIES & FED TARGET"
        title="FOMC POLICY RATE PROBABILITY MATRIX"
        subtitle="ST. LOUIS FED & OVERNIGHT INDEX SWAPS"
        sources="EFFR & SOFR BENCHMARKS"
        status={status}
      />

      <div className="panel-content-body">
        {status === "loading" && !data && (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "11px" }}>
            CALCULATING FOMC IMPLIED RATE HIKE / CUT PROBABILITIES...
          </div>
        )}

        {status === "error" && !data && (
          <div style={{ padding: "16px", color: "var(--color-red)", fontSize: "12px" }}>
            FAILED TO LOAD FED FUNDS RATE PROBABILITIES.
          </div>
        )}

        {data && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Key Central Bank Metrics Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "8px",
            }}
          >
            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>TARGET BAND</div>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                {data.targetLower.toFixed(2)}% - {data.targetUpper.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                FOMC Policy Ceiling/Floor
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>EFFECTIVE RATE (EFFR)</div>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "var(--accent)", marginTop: "2px" }}>
                {data.effectiveRate.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Volume-Weighted Median
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>OVERNIGHT SOFR</div>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                {data.sofr.toFixed(2)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>
                Secured Financing Rate
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>NEXT FOMC MEETING</div>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "var(--text)", marginTop: "2px" }}>
                {data.nextMeetingDate}
              </div>
              <div style={{ fontSize: "9px", color: "var(--accent)", marginTop: "2px" }}>
                IN {data.meetings[0]?.daysUntil ?? 0} DAYS
              </div>
            </div>

            <div style={{ background: "#0c0d0f", border: "1px solid var(--border)", padding: "8px 10px" }}>
              <div style={{ fontSize: "9px", color: "var(--muted)" }}>NEXT CUT PROBABILITY</div>
              <div style={{ fontSize: "17px", fontWeight: "bold", color: "var(--bid)", marginTop: "2px" }}>
                {((data.meetings[0]?.probCut25 ?? 0) + (data.meetings[0]?.probCut50 ?? 0)).toFixed(1)}%
              </div>
              <div style={{ fontSize: "9px", color: "var(--bid)", marginTop: "2px" }}>
                CONSENSUS: EASING
              </div>
            </div>
          </div>

          {/* FOMC Forward Meeting Matrix */}
          <div className="edgar-table-wrap">
            <table className="edgar-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>FOMC MEETING</th>
                  <th style={{ width: "80px", textAlign: "right" }}>DAYS TO</th>
                  <th style={{ width: "120px", textAlign: "right" }}>CURRENT BAND</th>
                  <th style={{ width: "110px", textAlign: "right" }}>HOLD PROB</th>
                  <th style={{ width: "110px", textAlign: "right" }}>-25 BPS CUT</th>
                  <th style={{ width: "110px", textAlign: "right" }}>-50 BPS CUT</th>
                  <th style={{ width: "110px", textAlign: "right" }}>IMPLIED RATE</th>
                  <th style={{ width: "100px", textAlign: "right" }}>BIAS</th>
                </tr>
              </thead>
              <tbody>
                {data.meetings.map((m) => (
                  <tr key={m.date} className="edgar-row">
                    <td className="edgar-date-col" style={{ fontWeight: 700, color: "var(--text)" }}>
                      {m.date}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                      +{m.daysUntil}d
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {m.currentBand}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: m.probHold > 50 ? "var(--accent)" : "var(--muted)" }}>
                      {m.probHold.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--bid)", fontWeight: 600 }}>
                      {m.probCut25.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: m.probCut50 > 10 ? "var(--bid)" : "var(--muted)" }}>
                      {m.probCut50.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--text)", fontWeight: 700 }}>
                      {m.impliedRate.toFixed(2)}%
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: "2px",
                          color: "var(--bid)",
                          background: "rgba(0, 200, 115, 0.1)",
                        }}
                      >
                        {m.consensusBias}
                      </span>
                    </td>
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

